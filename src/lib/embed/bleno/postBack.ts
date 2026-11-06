import {catchError, defer, from, map, Observable, of, switchMap} from 'rxjs';
import confirmationPopup from '@components/confirmationPopup';
import getPeerTitle from '@components/wrappers/getPeerTitle';
import {POST_PREVIEW_CHARS} from '@lib/embed/bleno/constants';
import type {BlenoChatTarget} from '@lib/embed/bleno/chatContext';
import type {SheetMessageOf} from '@lib/embed/bleno/types';

type PostRequest = SheetMessageOf<'post-request'>;

const preview = (request: PostRequest) => request.file ?
  request.file.name :
  `“${request.text.length > POST_PREVIEW_CHARS ? `${request.text.slice(0, POST_PREVIEW_CHARS - 1)}…` : request.text}”`;

/** "Send to <chat>?" in Telegram's own dialog. Completes with true on Send, false on Cancel. */
function confirm$(target: BlenoChatTarget, request: PostRequest): Observable<boolean> {
  return defer(() => from(getPeerTitle({peerId: target.peerId, plainText: true}))).pipe(
    switchMap((title) => defer(() => from(confirmationPopup({
      titleLangKey: 'Bleno.Send.Title',
      titleLangArgs: [title],
      descriptionLangKey: 'Bleno.Send.Text',
      descriptionLangArgs: [preview(request)],
      button: {langKey: 'Send'}
    })))),
    map(() => true),
    catchError(() => of(false))
  );
}

/** Sends as the person signed in to this tab: the text, or the file with the text as its caption. */
function send$(target: BlenoChatTarget, request: PostRequest): Observable<boolean> {
  const {managers, peerId, threadId} = target;
  const sent = () => request.file ?
    managers.appMessagesManager.sendFile({
      peerId,
      threadId,
      file: new File([request.file.blob], request.file.name, {type: request.file.mimeType}),
      caption: request.text,
      isMedia: false
    }) :
    managers.appMessagesManager.sendText({peerId, threadId, text: request.text});
  return defer(() => from(sent())).pipe(map(() => true), catchError(() => of(false)));
}

/** A sheet can never post on its own: the person says Send in Telegram first, every time. */
export function confirmAndPost$(target: BlenoChatTarget, request: PostRequest): Observable<boolean> {
  return confirm$(target, request).pipe(switchMap((ok) => ok ? send$(target, request) : of(false)));
}
