/**
 * Our build of Web K runs as the Telegram tab of Viya Connect, on the same origin. `VITE_VIYA=1` turns that on;
 * without it the app is the plain upstream client.
 */
export const IS_VIYA = import.meta.env.VITE_VIYA === '1';
/** The bot whose mini app proof (initData) Signal checks, to link this Telegram account. */
export const VIYA_BOT_USERNAME = import.meta.env.VITE_VIYA_BOT_USERNAME || '';

/**
 * Viya Connect's origin. In production the tab is served on it (/apps/telegram/); in development the
 * two run on separate dev servers, so the dev script says which one may talk to the tab.
 */
export const VIYA_ORIGIN = import.meta.env.VITE_VIYA_ORIGIN || location.origin;
/** The BroadcastChannel Viya Connect and its embedded apps share (same origin only). */
export const VIYA_CHANNEL = 'viya-connect';
/** `source` on Viya Connect's messages, and on ours. */
export const VIYA_SOURCE = 'viya-connect';
export const TELEGRAM_SOURCE = 'telegram';
/** A message arrives twice (postMessage and the channel): ids remembered to drop the second. */
export const VIYA_SEEN_IDS_LIMIT = 64;
/** How long to wait for Viya Connect to say who is signed in before showing the locked screen. */
export const VIYA_SESSION_WAIT_MS = 1500;
/** Where the mini app proof sits in the URL Telegram returns for a web app. */
export const WEB_APP_DATA_PARAM = 'tgWebAppData';
