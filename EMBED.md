# The embedded build of Telegram Web K

This is a modified version of [Telegram Web K](https://github.com/morethanwords/tweb), changed by Viya-Tech starting 2026-11-06. It is released under the same GPL-3.0 licence (`LICENSE`). Upstream's work is unchanged except for the files listed below.

The changes switch on only with `VITE_EMBED=1`. Without it, the app is the upstream client. Nothing in them names a product or a company: the app that frames this tab is "the host app".

## What it does
The app runs as the Telegram tab inside a host app, on the same origin. In development the host runs on its own dev server, and `VITE_EMBED_HOST_ORIGIN` names the origin the tab trusts besides its own.
- **Locked until you sign in to the host app.** The tab waits for the host's `session` message, and the stored Telegram session is encrypted with Web K's own passcode lock.
  - The passcode is a key the host's backend keeps for this person on this browser. The host hands it over after every sign-in, so the tab opens without a QR code.
  - Signing out of the host locks every Telegram tab of the browser.
  - If someone else signs in on that browser, their key can't open the stored session, so it's wiped. Telegram's session on the server isn't touched.
  - **Never a blank tab.** "Opening Telegram…" shows from the start of boot until the tab is unlocked. Each step after the host's session arrives (the settings read, the key check, the unlock, the wipe) has 10 s (`timedStep`). One that doesn't answer (a database another tab or an old worker holds open, a worker that never replies) shows "Telegram couldn't open its saved session" with Try again and Reset Telegram tab, and tells the host (`stuck`).
  - **Reset** (`resetTab.ts`): stops this tab's worker, then deletes Web K's service workers (under its own path), caches, IndexedDB databases and localStorage keys, and reloads. That signs this browser out of Telegram, not Telegram's session on the server. The host app's own storage is never touched. While another tab holds a database open it says "Close this app's other tabs to finish", and finishes once they're closed.
  - **A wipe that doesn't reload** (the worker's log out never brings the reload) is finished the same way a few seconds later.
  - Every step logs to the console as `[EMBED] <step>: …`, so a pasted console says where opening stopped.
- **One sign-out for everything.** When Telegram ends the tab's session (you log out, or terminate the session from your phone), the tab tells the host, which signs out everywhere.
- **Linking.** After a Telegram login, the tab compares the account with the one the host has linked.
  - If nothing is linked, it asks Telegram for the bot's mini-app proof (`initData`, set with `VITE_EMBED_LINK_BOT`) and offers it to the host.
  - If a different account is linked, it says so.
- **One account per tab.** "Add account", the lock button and the Passcode Lock setting are hidden, because the tab's passcode isn't the person's to set.
- **Bleno mode.** Typing `@bleno ` at the start of a message, or picking Bleno's row (its logo, "Bleno", "Ask about this chat") from the @ list, fades Telegram's input bar out and Bleno's card in where it was: a frame of Bleno's `/sheet` page (`VITE_EMBED_BLENO_URL`), drawn by Bleno in its own design tokens, with a one-line header (logo, "Bleno", the chat, ×), the talk, and Bleno's own composer. It grows up over the chat as the talk grows, to 60% of the chat or 35rem, then the talk scrolls. × or Esc gives the bar back, with its draft. The @ row spans the input, at Telegram's helper-row height (`$chat-helper-size`).
  - Bleno sees the open chat: its name and the latest 50 messages, and more, a page at a time, when it asks.
  - It may take a file from the chat: spreadsheets and documents only (`xlsx`, `xls`, `xlsm`, `csv`, `tsv`, `ods`, `pdf`, `docx`, `txt`), 5 MB at most, 3 a question. The tab checks the type and size again before downloading.
  - It may post into the chat as you, but only after you say Send in Telegram's own confirm, every time.
  - "Add to Bleno" in a message's menu opens the sheet and hands it that message and its file.
  - The host's access token is passed to the sheet in memory only.

## Files
- **New:**
  - `src/lib/embed/`: `constants.ts`, `types.ts`, `bridge.ts` (messages to and from the host), `tabLock.tsx`, `steps.ts` (time limits and `[EMBED]` logs), `resetTab.ts`, `proof.ts`
  - `src/lib/embed/bleno/`: `blenoMode.ts` (the swap, the card and every flow, as RxJS streams), `sheetChannel.ts` (the frame's messages, checked), `chatContext.ts`, `chatFile.ts`, `fileRules.ts`, `postBack.ts`, `blenoHelper.ts` (the @ row), `blenoLogo.ts`, `blenoUrls.ts`, `trigger.ts`, `typedInput.ts` (whether a change was typed: the editor's own input event doesn't say), `constants.ts`, `types.ts`, `blenoMode.module.scss`
  - `src/components/embed/lockedScreen.*`
  - `src/tests/embedBleno.test.ts`, `src/tests/embedTabLock.test.ts`, `e2e/chatInputEditorBlenoTyping.spec.ts` (the editor suite: typing reaches the box as a trusted event before the editor's own)
- **Changed:**
  - `src/index.ts`: the gate before the passcode check, and "Opening Telegram…" from the start of boot
  - `src/pages/bootstrapIm.ts`: the after-sign-in check
  - `src/lib/mainWorker/index.worker.ts` and `mainMessagePort.ts`: the `embedLock` task, sharing auto-lock's code
  - `src/components/sidebarLeft/index.ts` and `src/components/sidebarLeft/tabs/privacyAndSecurity.tsx`
  - `src/components/chat/input.ts`: the Bleno helper, the `@bleno ` call (typed only, `watchTyping`) and the @ branch
  - `src/components/chat/contextMenu.ts`: "Add to Bleno"
  - `src/lang.ts`: the `Embed.*` and `Bleno.*` strings
  - `src/env.d.ts`, `package.json` (`rxjs`)
  - `scripts/import-graph.budget.json`: +8 for the new modules on the boot path

## The sheet protocol
The tab talks only to its own sheet frame: it posts with the sheet's origin as the target, and takes a message only from that frame's window, from that origin, with `source: "bleno-sheet"`, every field checked (`parseSheetMessage`). Its own messages carry `source: "telegram"`.

| Direction | Message | The other side does |
| --- | --- | --- |
| sheet → tab | `ready` | Answers with `session`, `theme` and `chat` |
| tab → sheet | `session` (`signed_in` with `accessToken` and `user.id`, or `signed_out`) | Bearer for the Bleno server; signed out closes the sheet |
| tab → sheet | `theme` | Follows Telegram's day or night |
| tab → sheet | `chat` (`{ key, title, kind }` and the latest page) | One conversation per chat `key` |
| tab → sheet | `draft` (`text`) | "@bleno what's late?" puts the question in Bleno's box |
| tab → sheet | `added` (`{ message }`) | "Add to Bleno": a chip, and its file taken at once |
| sheet → tab | `resize` (`height`) | The card's height (header, all of its talk, composer); the tab keeps it within 60% of the chat and 35rem |
| sheet → tab | `close` | Gives Telegram its input bar back |
| sheet → tab | `history-request` (`requestId, before, limit`) | `history` (`page`) or `refused` |
| sheet → tab | `file-request` (`requestId, ref`) | `file` (the Blob) or `refused` (`reason`) |
| sheet → tab | `post-request` (`requestId, text?, file?`) | Telegram's "Send to …?" confirm, then `posted` (`ok`) |

The host's own protocol (session, theme, windows) is documented in the host app's `AGENTS.md`, under "Embedded apps".
