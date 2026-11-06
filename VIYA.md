# Viya Connect's build of Telegram Web K

This is a modified version of [Telegram Web K](https://github.com/morethanwords/tweb), changed by Viya-Tech starting 2026-11-06. It is released under the same GPL-3.0 licence (`LICENSE`). Upstream's work is unchanged except for the files listed below.

The changes switch on only with `VITE_VIYA=1`. Without it, the app is the upstream client.

## What it does
The app runs as the Telegram tab inside Viya Connect, on the same origin.
- **Locked until you sign in to Viya Connect.** The tab waits for Viya Connect's `session` message, and the stored Telegram session is encrypted with Web K's own passcode lock.
  - The passcode is a key that Signal keeps for this person on this browser. Viya Connect hands it over after every sign-in, so the tab opens without a QR code.
  - Signing out of Viya Connect locks every Telegram tab of the browser.
  - If someone else signs in on that browser, their key can't open the stored session, so it's wiped. Telegram's session on the server isn't touched.
- **One sign-out for everything.** When Telegram ends the tab's session (you log out, or terminate the session from your phone), the tab tells Viya Connect, which signs out everywhere.
- **Linking.** After a Telegram login, the tab compares the account with the one linked in Signal.
  - If nothing is linked, it asks Telegram for our bot's mini-app proof (`initData`, set with `VITE_VIYA_BOT_USERNAME`) and offers it to Viya Connect. Signal checks that proof with the bot token.
  - If a different account is linked, it says so.
- **One account per tab.** "Add account", the lock button and the Passcode Lock setting are hidden, because the tab's passcode isn't the person's to set.

## Files
- **New:**
  - `src/lib/viya/`: `constants.ts`, `types.ts`, `bridge.ts` (messages to and from Viya Connect), `tabLock.tsx`, `proof.ts`
  - `src/components/viya/lockedScreen.*`
- **Changed:**
  - `src/index.ts`: the gate before the passcode check
  - `src/pages/bootstrapIm.ts`: the after-sign-in check
  - `src/lib/mainWorker/index.worker.ts` and `mainMessagePort.ts`: the `viyaLock` task, sharing auto-lock's code
  - `src/components/sidebarLeft/index.ts` and `src/components/sidebarLeft/tabs/privacyAndSecurity.tsx`
  - `src/lang.ts`: two strings
  - `src/env.d.ts`
  - `scripts/import-graph.budget.json`: +8 for the new modules on the boot path

The message protocol is documented in Viya Connect's `AGENTS.md`, under "Embedded apps".
