import {BLENO_CALL, BLENO_HANDLE, BLENO_MIN_QUERY, TRAILING_AT_TOKEN} from '@lib/embed/bleno/constants';

/** The @ list's query ("@bl") could still become "@bleno", typed at the start of the message. */
export function offersBleno(query: string, fromStart: boolean) {
  const typed = query.toLowerCase();
  return fromStart && typed.length >= BLENO_MIN_QUERY && BLENO_HANDLE.startsWith(typed);
}

/** "@bleno what's late?" gives "what's late?"; anything that isn't a Bleno call gives null. */
export function blenoCall(text: string): string | null {
  const match = BLENO_CALL.exec(text);
  return match ? match[1].trim() : null;
}

/** The draft as it was before "@bl…" was typed at its end. */
export function withoutAtToken(text: string) {
  return text.replace(TRAILING_AT_TOKEN, '$1').trimEnd();
}
