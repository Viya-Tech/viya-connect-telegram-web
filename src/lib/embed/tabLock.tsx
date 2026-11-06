import {createRoot} from 'solid-js';
import deferredPromise from '@helpers/cancellablePromise';
import {hotListen} from '@helpers/hotModule';
import pause from '@helpers/schedulers/pause';
import {hideLockedScreen, showLockedScreen} from '@components/embed/lockedScreen';
import apiManagerProxy from '@lib/apiManagerProxy';
import commonStateStorage from '@lib/commonStateStorage';
import {PasscodeActions, usePasscodeActions} from '@lib/passcode/actions';
import rootScope from '@lib/rootScope';
import LockScreenHotReloadGuardProvider from '@lib/solidjs/lockScreenHotReloadGuardProvider';
import {getLastHostSession, onHostSession, sendToHost} from '@lib/embed/bridge';
import {HOST_SESSION_WAIT_MS} from '@lib/embed/constants';
import {requestLinkProof} from '@lib/embed/proof';
import type {HostSession} from '@lib/embed/types';

/**
 * The Telegram tab opens only for whoever is signed in to the host app. Its stored Telegram session is encrypted with
 * Web K's own passcode lock, the passcode being a key Signal keeps for this person on this browser: the host app
 * hands it over after every sign-in, so the tab opens with no QR code, and a sign-out locks it again. Someone
 * else's key can't open it, so their sign-in wipes this browser's copy (Telegram's session itself is untouched).
 */
let tabKey: string;
let signedInUserId: string;
let wiping = false;

/** The built-in passcode actions, run with the tab key as the passcode, so nothing about the encryption is copied. */
function passcodeActions(): PasscodeActions {
  let actions: PasscodeActions;
  const Take = () => {
    actions = usePasscodeActions();
    return undefined as undefined;
  };
  createRoot((dispose) => {
    const tree = <LockScreenHotReloadGuardProvider><Take /></LockScreenHotReloadGuardProvider>;
    dispose();
    return tree;
  });
  return actions;
}

async function isUsingPasscode() {
  const settings = await commonStateStorage.get('settings', false);
  return !!settings?.passcode?.enabled;
}

/** The first session the host app announces; the locked screen covers the wait when it takes a while. */
function firstSession() {
  const deferred = deferredPromise<HostSession>();
  const stop = onHostSession((session) => {
    stop();
    deferred.resolve(session);
  });
  sendToHost({type: 'ready'});
  pause(HOST_SESSION_WAIT_MS).then(() => {
    if(!deferred.isFulfilled) showLockedScreen();
  });
  return deferred;
}

function waitForever() {
  return new Promise<never>(() => {});
}

/** Locks every Telegram tab of this browser: the worker reloads them and forgets the key. */
function lockTab() {
  showLockedScreen();
  apiManagerProxy.invokeVoid('embedLock', undefined);
}

/** Someone else's tab on this browser: drop its stored copy, then start again on the sign-in screen. */
async function wipeTab() {
  wiping = true;
  showLockedScreen();
  await apiManagerProxy.invoke('forceLogout', undefined);
}

function followSessions() {
  onHostSession((session) => {
    const isOtherPerson = session.state === 'signed_out' || session.userId !== signedInUserId;
    const isNewKey = session.state === 'signed_in' && !!session.tabKey && session.tabKey !== tabKey;
    if(isOtherPerson || isNewKey) lockTab();
  });
}

/** Runs before Web K's own unlock check: unlocks with the tab key, or keeps the tab locked until there is one. */
export async function waitForHostUnlock(): Promise<void> {
  const session = await firstSession();
  if(session.state !== 'signed_in' || !session.tabKey) {
    showLockedScreen();
    onHostSession((next) => {
      if(next.state === 'signed_in' && next.tabKey) location.reload();
    });
    return waitForever();
  }

  tabKey = session.tabKey;
  signedInUserId = session.userId;

  const usingPasscode = await isUsingPasscode();
  if(usingPasscode) {
    const actions = passcodeActions();
    const isTheirs = await actions.isMyPasscode(tabKey);
    if(!isTheirs) {
      await wipeTab();
      return waitForever();
    }

    await actions.unlockWithPasscode(tabKey);
  }

  hideLockedScreen();
  followSessions();
}

/**
 * Signed in to Telegram (a fresh QR or phone login, or a boot that already was): encrypts the stored session with
 * the tab key, then checks this Telegram account against the one linked in Signal.
 */
export async function onHostSignedIn() {
  if(!tabKey) return;

  const usingPasscode = await isUsingPasscode();
  if(!usingPasscode) {
    await passcodeActions().enablePasscode(tabKey);
  }

  const session = getLastHostSession();
  if(session?.state !== 'signed_in') return;

  const myId = String(rootScope.myId);
  if(session.telegramId === myId) return;
  if(session.telegramId) {
    sendToHost({type: 'wrong-account'});
    return;
  }

  const proof = await requestLinkProof();
  if(proof) sendToHost({type: 'link-offer', ...proof});
}

// * Telegram ended this tab's session: signing out of one signs out of all three
hotListen(import.meta.hot, rootScope, 'logging_out', () => {
  if(!wiping) sendToHost({type: 'signed-out'});
});
