import {hotEffect} from '@helpers/hotModule';
import {randomLong} from '@helpers/random';

import {TELEGRAM_SOURCE, VIYA_CHANNEL, VIYA_ORIGIN, VIYA_SEEN_IDS_LIMIT, VIYA_SOURCE} from '@lib/viya/constants';
import type {ViyaOutgoing, ViyaSession} from '@lib/viya/types';

const seenIds: string[] = [];
const listeners = new Set<(session: ViyaSession) => void>();
let channel: BroadcastChannel;
let lastSession: ViyaSession;

function firstDelivery(id: string) {
  if(seenIds.includes(id)) return false;
  seenIds.push(id);
  if(seenIds.length > VIYA_SEEN_IDS_LIMIT) seenIds.shift();
  return true;
}

function toSession(data: any): ViyaSession {
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
    tabKey: typeof data.telegramTabKey === 'string' ? data.telegramTabKey : null
  };
}

/** Only Viya Connect's own `session` messages, from its origin, each once. */
function onMessage(data: any) {
  if(data?.source !== VIYA_SOURCE || data.type !== 'session' || typeof data.id !== 'string') return;
  if(!firstDelivery(data.id)) return;

  const session = toSession(data);
  if(!session) return;

  lastSession = session;
  listeners.forEach((listener) => listener(session));
}

hotEffect(import.meta.hot, () => {
  const onWindowMessage = (event: MessageEvent) => {
    if(event.origin === VIYA_ORIGIN) onMessage(event.data);
  };
  const onChannelMessage = (event: MessageEvent) => onMessage(event.data);

  window.addEventListener('message', onWindowMessage);
  channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(VIYA_CHANNEL);
  channel?.addEventListener('message', onChannelMessage);

  return () => {
    window.removeEventListener('message', onWindowMessage);
    channel?.close();
    channel = undefined;
  };
});

/** To the frame's parent or the popup's opener, and the channel: Viya Connect drops the copy it already has. */
export function sendToViya(message: ViyaOutgoing) {
  const payload = {source: TELEGRAM_SOURCE, id: randomLong(), ...message};
  for(const target of [window.parent !== window ? window.parent : undefined, window.opener as Window]) {
    try {
      target?.postMessage(payload, VIYA_ORIGIN);
    } catch(err) {
      // * the opener navigated away or closed: the channel still carries it
    }
  }

  channel?.postMessage(payload);
}

/** Every session Viya Connect announces from now on. */
export function onViyaSession(listener: (session: ViyaSession) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastViyaSession() {
  return lastSession;
}
