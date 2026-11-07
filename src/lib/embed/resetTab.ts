import {EMBED_CACHE_NAMES, EMBED_DATABASE, EMBED_STORAGE_KEY} from '@lib/embed/constants';
import {embedLog} from '@lib/embed/steps';

/**
 * Clears what this tab keeps in the browser: its service workers (under its own path) and caches, and with
 * `signOut` its databases and keys too, which signs this browser out of Telegram (Telegram's session on the
 * server is untouched). Nothing the host app keeps is touched: only Web K's own names. `onBlocked` is told when
 * a database can't go yet because another tab (or an old worker) still has it open; it goes once that one lets go.
 */
export async function resetTab({signOut, onBlocked}: {signOut: boolean, onBlocked?: () => void}) {
  const scope = new URL('./', location.href).href;
  const found = navigator.serviceWorker?.getRegistrations() ?? Promise.resolve([] as ServiceWorkerRegistration[]);
  const registrations = await found;
  const unregistered = registrations.filter((r) => r.scope.startsWith(scope)).map((r) => r.unregister());
  const cleared = typeof caches === 'undefined' ? [] : EMBED_CACHE_NAMES.map((name) => caches.delete(name));
  await Promise.allSettled([...unregistered, ...cleared]);
  embedLog('reset', `service workers ${unregistered.length}, caches cleared`);
  if(!signOut) return;

  const listed = typeof indexedDB.databases === 'function' ? indexedDB.databases() : Promise.resolve([] as IDBDatabaseInfo[]);
  const databases = await listed;
  const names = databases.map((db) => db.name).filter((name) => name && EMBED_DATABASE.test(name));
  await Promise.all(names.map((name) => deleteDatabase(name, onBlocked)));
  try {
    for(const key of Object.keys(localStorage)) if(EMBED_STORAGE_KEY.test(key)) localStorage.removeItem(key);
  } catch(err) {
    // * storage refused (a private window): nothing kept there anyway
  }
  embedLog('reset', `databases ${names.join(', ') || 'none'} and keys cleared`);
}

function deleteDatabase(name: string, onBlocked?: () => void) {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => {
      embedLog('reset', `${name} is still open elsewhere`);
      onBlocked?.();
    };
  });
}
