/** What starts Bleno mode in the message box: typed at the very start, or picked from the @ list. */
export const BLENO_HANDLE = '@bleno';
/** "@bl", "@ble", …: the @ list offers Bleno (alone) once this much of the handle is typed. */
export const BLENO_MIN_QUERY = 3;
/** "@bleno " followed by a question: everything after the handle and its space. */
export const BLENO_CALL = /^@bleno\s+([\s\S]*)$/i;
/** A change to the message box this soon after the browser's own typing event counts as typed (`typedInput.ts`). */
export const TYPED_INPUT_WINDOW_MS = 1000;
/** What's left of the draft once the @ token being typed at its end is taken off. */
export const TRAILING_AT_TOKEN = /(^|\s)@\S*$/;

/** Where the sheet loads from (VITE_EMBED_BLENO_URL: the host build's Bleno, `/apps/bleno/` by default). */
export const BLENO_BASE_URL = import.meta.env.VITE_EMBED_BLENO_URL || '/apps/bleno/';
export const BLENO_SHEET_PATH = 'sheet';
/** Bleno's logo, served by Bleno itself, beside its sheet. */
export const BLENO_LOGO_PATH = 'bleno.svg';
/** `source` on the sheet's messages, and on the tab's to it. */
export const SHEET_SOURCE = 'bleno-sheet';
export const TAB_SOURCE = 'telegram';

/** The chat Bleno sees: a page of 50 messages at a time, each cut to 1,000 characters. */
export const CHAT_PAGE_SIZE = 50;
export const CHAT_PAGE_MAX = 100;
export const MESSAGE_TEXT_MAX = 1000;

/** Small files only: spreadsheets and documents, 5 MB at most, 3 a question. */
export const FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FILES_PER_REQUEST = 3;
export const FILE_EXTENSIONS = new Set(['xlsx', 'xls', 'xlsm', 'csv', 'tsv', 'ods', 'pdf', 'docx', 'txt']);
export const FILE_EXTENSION = /\.([a-z0-9]+)$/i;
export const FILE_TYPE_REFUSED = 'Bleno reads spreadsheets and documents only.';
export const FILE_TOO_BIG = 'Too big for Bleno (5 MB at most).';
export const FILE_GONE = 'That file is no longer in this chat.';
export const FILE_NOT_OFFERED = 'That file isn’t in the part of the chat Bleno has seen.';

/** What Bleno may post into a chat. */
export const POST_TEXT_MAX = 4096;
export const POST_PREVIEW_CHARS = 200;

/** Bleno's card, in the input bar's place: as tall as Bleno asks, at most 60% of the chat (its talk scrolls past that). */
export const CARD_MAX_SHARE = 0.6;
export const CARD_MAX_PX = 560;
/** How long the fade out takes before the card is hidden (the fade in is longer, in the stylesheet). */
export const CARD_FADE_OUT_MS = 120;
