import {BLENO_BASE_URL, BLENO_LOGO_PATH, BLENO_SHEET_PATH} from '@lib/embed/bleno/constants';

const base = () => new URL(BLENO_BASE_URL, location.href);

/** Bleno's answer card, framed above the message box. */
export const blenoSheetUrl = () => new URL(BLENO_SHEET_PATH, base()).href;
export const blenoLogoUrl = () => new URL(BLENO_LOGO_PATH, base()).href;
