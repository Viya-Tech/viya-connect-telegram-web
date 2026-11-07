/**
 * Our build of Web K runs as the Telegram tab of the host app, on the same origin. `VITE_EMBED=1` turns that on;
 * without it the app is the plain upstream client.
 */
export const IS_EMBEDDED = import.meta.env.VITE_EMBED === '1';
/** The bot whose mini app proof (initData) Signal checks, to link this Telegram account. */
export const LINK_BOT_USERNAME = import.meta.env.VITE_EMBED_LINK_BOT || '';

/** The BroadcastChannel the host app and its embedded apps share (same origin only). */
export const HOST_CHANNEL = 'embedded-apps';
/**
 * The host app's origins this tab trusts and talks to: its own (a build, where the host serves the tab) and
 * VITE_EMBED_HOST_ORIGIN (development, where the host runs on its own dev server, e.g. http://localhost:5173).
 */
export const HOST_ORIGINS: ReadonlySet<string> = new Set([location.origin, import.meta.env.VITE_EMBED_HOST_ORIGIN].filter(Boolean));
/** `source` on the host app's messages, and on ours. */
export const HOST_SOURCE = 'host';
export const TELEGRAM_SOURCE = 'telegram';
/** A message arrives twice (postMessage and the channel): ids remembered to drop the second. */
export const HOST_SEEN_IDS_LIMIT = 64;
/** How long to wait for the host app to say who is signed in before showing the locked screen. */
export const HOST_SESSION_WAIT_MS = 1500;
/** Where the mini app proof sits in the URL Telegram returns for a web app. */
export const WEB_APP_DATA_PARAM = 'tgWebAppData';
/** How long one step of opening the saved session (the settings read, the key check, the unlock, the wipe) may take. */
export const EMBED_STEP_TIMEOUT_MS = 10_000;
/** After a wipe's log out, how long to wait for the reload it brings before clearing the storage here. */
export const EMBED_WIPE_RELOAD_WAIT_MS = 4000;
/** Web K's stored state: its CacheStorage caches, IndexedDB databases and (unprefixed, `t_` on test servers) localStorage keys. */
export const EMBED_CACHE_NAMES: readonly string[] = [
  'cachedAssets',
  'cachedFiles',
  'cachedBackgrounds',
  'cachedStreamChunks',
  'cachedHlsStreamChunks',
  'cachedHlsQualityFiles'
];
export const EMBED_DATABASE = /^(telegram|tweb|tweb-common|tweb-account-\d+)$/;
export const EMBED_STORAGE_KEY =
  /^(t_)?(state_id|account\d|encryption_key|server_time_offset|xt_instance|kz_version|tgme_sync|k_build|number_of_accounts|previous_account|current_account|should_animate_main|dc|user_auth|dc\d_(auth_key|server_salt|hash)|auth_key_fingerprint|experimental_flags)$/;
