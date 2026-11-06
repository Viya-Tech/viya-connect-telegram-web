import {defaultIfEmpty, defer, forkJoin, from, map, Observable, of, switchMap} from 'rxjs';
import type {Message} from '@layer';
import type {AppManagers} from '@lib/managers';
import getPeerTitle from '@components/wrappers/getPeerTitle';
import {CHAT_PAGE_MAX, CHAT_PAGE_SIZE, MESSAGE_TEXT_MAX} from '@lib/embed/bleno/constants';
import {describeFile} from '@lib/embed/bleno/chatFile';
import type {BlenoChatInfo, BlenoChatMessage, BlenoChatPage} from '@lib/embed/bleno/types';

/** The chat a Bleno sheet is about. */
export type BlenoChatTarget = {managers: AppManagers, peerId: PeerId, threadId?: number, myId: PeerId};

const clip = (text: string) => text.length > MESSAGE_TEXT_MAX ? `${text.slice(0, MESSAGE_TEXT_MAX - 1)}…` : text;
const title$ = (peerId: PeerId) => defer(() => from(getPeerTitle({peerId, plainText: true})));

/** The names of everyone who wrote these messages, each looked up once. */
function senders$(target: BlenoChatTarget, messages: Message.message[]): Observable<Map<PeerId, string>> {
  const ids = [...new Set(messages.map((message) => message.fromId))].filter((id) => id !== target.myId);
  return forkJoin(ids.map((id) => title$(id).pipe(map((name) => [id, name] as const)))).pipe(
    defaultIfEmpty([] as (readonly [PeerId, string])[]),
    map((pairs) => new Map(pairs))
  );
}

/** One message, as Bleno sees it. */
export function toBlenoMessage(message: Message.message, sender: string): BlenoChatMessage {
  const file = describeFile(message);
  const replyTo = message.reply_to?._ === 'messageReplyHeader' ? message.reply_to.reply_to_msg_id : undefined;
  return {
    id: message.mid,
    sender,
    date: message.date,
    text: clip(message.message || ''),
    ...(replyTo && {replyTo}),
    ...(file && {files: [file]})
  };
}

/** Looks the messages up and names their senders: one page, oldest first. */
function pageOf$(target: BlenoChatTarget, mids: number[], limit: number): Observable<BlenoChatPage> {
  const {managers, peerId} = target;
  return forkJoin(mids.map((mid) => defer(() => from(managers.appMessagesManager.getMessageByPeer(peerId, mid))))).pipe(
    defaultIfEmpty([]),
    map((found) => found.filter((message): message is Message.message => message?._ === 'message')),
    switchMap((messages) => senders$(target, messages).pipe(map((names) => ({messages, names})))),
    map(({messages, names}) => ({
      messages: messages
      .map((message) => toBlenoMessage(message, message.fromId === target.myId ? 'You' : names.get(message.fromId) ?? ''))
      .reverse(),
      before: mids.length < limit ? null : mids[mids.length - 1]
    }))
  );
}

/** A page of the chat: the latest one, or the one before `before`. */
export function chatPage$(target: BlenoChatTarget, before: number | null, limit = CHAT_PAGE_SIZE): Observable<BlenoChatPage> {
  const {managers, peerId, threadId} = target;
  const size = Math.min(Math.max(limit, 1), CHAT_PAGE_MAX);
  return defer(() => from(managers.appMessagesManager.getHistory({peerId, threadId, limit: size, ...(before && {offsetId: before})}))).pipe(
    switchMap((history) => pageOf$(target, history.history, size))
  );
}

/** One message, for "Add to Bleno". */
export function chatMessage$(target: BlenoChatTarget, mid: number): Observable<BlenoChatMessage | undefined> {
  return pageOf$(target, [mid], 1).pipe(map((page) => page.messages[0]));
}

/** The chat's name and kind; `key` keeps one conversation per chat. */
export function chatInfo$(target: BlenoChatTarget): Observable<BlenoChatInfo> {
  const {managers, peerId, threadId} = target;
  const kind$ = peerId.isUser() ?
    of('private' as const) :
    defer(() => from(managers.appPeersManager.isBroadcast(peerId))).pipe(map((broadcast) => broadcast ? 'channel' as const : 'group' as const));
  return forkJoin({title: title$(peerId), kind: kind$}).pipe(
    map(({title, kind}) => ({key: threadId ? `${peerId}_${threadId}` : `${peerId}`, title, kind}))
  );
}
