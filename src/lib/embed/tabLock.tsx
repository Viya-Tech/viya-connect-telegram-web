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
import {IDB} from '@lib/files/idb';
import {EMBED_WIPE_RELOAD_WAIT_MS, HOST_SESSION_WAIT_MS} from '@lib/embed/constants';
import {requestLinkProof} from '@lib/embed/proof';
import {resetTab} from '@lib/embed/resetTab';
import {EmbedStepTimeout, embedLog, timedStep} from '@lib/embed/steps';
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

/** The first session the host app announces; "Opening" turns to the locked screen when it takes a while. */
function firstSession() {
  const deferred = deferredPromise<HostSession>();
  const stop = onHostSession((session) => {
    stop();
    embedLog('session', session.state === 'signed_in' ? `signed in${session.tabKey ? '' : ', no tab key'}` : 'signed out');
    deferred.resolve(session);
  });
  sendToHost({type: 'ready'});
  embedLog('session', 'ready sent, waiting for the host');
  pause(HOST_SESSION_WAIT_MS).then(() => {
    if(!deferred.isFulfilled) showLockedScreen('locked');
  });
  return deferred;
}

/**
 * Clears this browser's copy of the tab and starts again. While another tab (or an old worker) holds the stored
 * session open, it says so rather than waiting silently, and carries on once that one lets go.
 */
async function resetAndReload() {
  wiping = true;
  showLockedScreen('opening');
  // * this tab's own worker holds the databases open too: it stops (and its connections go) before they're deleted
  apiManagerProxy.invokeVoid('terminate', undefined);
  IDB.closeDatabases();
  await resetTab({signOut: true, onBlocked: () => showLockedScreen('blocked')});
  embedLog('reset', 'reloading');
  location.reload();
}

/** A step of opening the saved session took too long: say so (here and to the host) and wait for the person. */
function stuck(step: string): Promise<never> {
  sendToHost({type: 'stuck', step});
  showLockedScreen('stuck', {
    onRetry: () => location.reload(),
    onReset: () => void resetAndReload()
  });
  return waitForever();
}

function waitForever() {
  return new Promise<never>(() => {});
}

/** Locks every Telegram tab of this browser: the worker reloads them and forgets the key. */
function lockTab() {
  showLockedScreen('locked');
  apiManagerProxy.invokeVoid('embedLock', undefined);
}

/**
 * Someone else's tab on this browser (or a key that changed): drop its stored copy, then start again on the sign-in
 * screen. The worker's log out reloads the tab; when no reload comes, the storage is cleared here and the tab reloads.
 */
async function wipeTab(): Promise<never> {
  wiping = true;
  showLockedScreen('opening');
  try {
    await timedStep('wipe', () => apiManagerProxy.invoke('forceLogout', undefined));
  } catch(err) {
    embedLog('wipe', 'the log out didn\'t finish: clearing here');
    await resetAndReload();
    return waitForever();
  }

  await pause(EMBED_WIPE_RELOAD_WAIT_MS);
  embedLog('wipe', `no reload after ${EMBED_WIPE_RELOAD_WAIT_MS} ms: clearing here`);
  await resetAndReload();
  return waitForever();
}

function followSessions() {
  onHostSession((session) => {
    const isOtherPerson = session.state === 'signed_out' || session.userId !== signedInUserId;
    const isNewKey = session.state === 'signed_in' && !!session.tabKey && session.tabKey !== tabKey;
    if(isOtherPerson || isNewKey) lockTab();
  });
}

/**
 * Runs before Web K's own unlock check: unlocks with the tab key, or keeps the tab locked until there is one.
 * Something is drawn the whole time ("Opening Telegram…"), and each step after the session arrives has a time
 * limit: one that doesn't answer (a database another tab holds open, a worker that never replies) shows Try again
 * and Reset instead of a blank tab.
 */
export async function waitForHostUnlock(): Promise<void> {
  showLockedScreen('opening');
  const session = await firstSession();
  if(session.state !== 'signed_in' || !session.tabKey) {
    showLockedScreen('locked');
    onHostSession((next) => {
      if(next.state === 'signed_in' && next.tabKey) location.reload();
    });
    return waitForever();
  }

  showLockedScreen('opening');
  tabKey = session.tabKey;
  signedInUserId = session.userId;

  try {
    const usingPasscode = await timedStep('settings', isUsingPasscode);
    if(usingPasscode) {
      const actions = passcodeActions();
      const isTheirs = await timedStep('key', () => actions.isMyPasscode(tabKey));
      if(!isTheirs) return await wipeTab();
      await timedStep('unlock', () => actions.unlockWithPasscode(tabKey));
    }
  } catch(err) {
    if(err instanceof EmbedStepTimeout) return await stuck(err.step);
    // * a step that failed outright is stuck too: the saved session couldn't be opened
    return await stuck('unlock');
  }

  embedLog('unlock', 'open');
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
