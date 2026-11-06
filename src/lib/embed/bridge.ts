import {Observable} from 'rxjs';
import {hotEffect} from '@helpers/hotModule';
import {randomLong} from '@helpers/random';

import {TELEGRAM_SOURCE, HOST_CHANNEL, HOST_ORIGINS, HOST_SEEN_IDS_LIMIT, HOST_SOURCE} from '@lib/embed/constants';
import type {HostOutgoing, HostSession} from '@lib/embed/types';

const seenIds: string[] = [];
const listeners = new Set<(session: HostSession) => void>();
let channel: BroadcastChannel;
let lastSession: HostSession;

function firstDelivery(id: string) {
  if(seenIds.includes(id)) return false;
  seenIds.push(id);
  if(seenIds.length > HOST_SEEN_IDS_LIMIT) seenIds.shift();
  return true;
}

function toSession(data: any): HostSession {
  if(data.state === 'signed_out') {
    return {state: 'signed_out'};
  }

  if(data.state !== 'signed_in' || typeof data.user?.id !== 'string') {
    return;
  }

  const {telegramId} = data.user;
  return {
    state: 'signed_in',
    userId: data.user.id,
    telegramId: typeof telegramId === 'string' ? telegramId : null,
    tabKey: typeof data.telegramTabKey === 'string' ? data.telegramTabKey : null,
    accessToken: typeof data.accessToken === 'string' ? data.accessToken : null
  };
}

/** Only the host app's own `session` messages, from its origin, each once. */
function onMessage(data: any) {
  if(data?.source !== HOST_SOURCE || data.type !== 'session' || typeof data.id !== 'string') return;
  if(!firstDelivery(data.id)) return;

  const session = toSession(data);
  if(!session) return;

  lastSession = session;
  listeners.forEach((listener) => listener(session));
}

hotEffect(import.meta.hot, () => {
  const onWindowMessage = (event: MessageEvent) => {
    if(HOST_ORIGINS.has(event.origin)) onMessage(event.data);
  };
  const onChannelMessage = (event: MessageEvent) => onMessage(event.data);

  window.addEventListener('message', onWindowMessage);
  channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(HOST_CHANNEL);
  channel?.addEventListener('message', onChannelMessage);

  return () => {
    window.removeEventListener('message', onWindowMessage);
    channel?.close();
    channel = undefined;
  };
});

/**
 * The origin to post to: the parent frame's, as the browser reports it, when it's one this tab trusts; else each
 * trusted one (a wrong target just drops the message, so only the host's own window can read it).
 */
function hostTargetOrigins(): string[] {
  const parent = location.ancestorOrigins?.[0];
  return parent && HOST_ORIGINS.has(parent) ? [parent] : [...HOST_ORIGINS];
}

/** To the frame's parent or the popup's opener, and the channel: the host app drops the copy it already has. */
export function sendToHost(message: HostOutgoing) {
  const payload = {source: TELEGRAM_SOURCE, id: randomLong(), ...message};
  for(const target of [window.parent !== window ? window.parent : undefined, window.opener as Window]) {
    try {
      hostTargetOrigins().forEach((origin) => target?.postMessage(payload, origin));
    } catch(err) {
      // * the opener navigated away or closed: the channel still carries it
    }
  }

  channel?.postMessage(payload);
}

/** Every session the host app announces from now on. */
export function onHostSession(listener: (session: HostSession) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastHostSession() {
  return lastSession;
}

/** The last session the host app announced, then every one after it. */
export function hostSession$() {
  return new Observable<HostSession>((subscriber) => {
    if(lastSession) subscriber.next(lastSession);
    return onHostSession((session) => subscriber.next(session));
  });
}
