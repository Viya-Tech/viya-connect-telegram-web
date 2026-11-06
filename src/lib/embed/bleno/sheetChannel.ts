import {filter, fromEvent, map, Observable, share} from 'rxjs';
import {POST_TEXT_MAX, SHEET_SOURCE, TAB_SOURCE} from '@lib/embed/bleno/constants';
import type {SheetMessageOf, SheetToTab, TabToSheet} from '@lib/embed/bleno/types';

const isString = (value: unknown): value is string => typeof value === 'string';
const isRequest = (data: any) => isString(data.requestId);

function isPostRequest(data: any) {
  const textOk = data.text === undefined || (isString(data.text) && data.text.length <= POST_TEXT_MAX);
  const file = data.file;
  const fileOk = file === undefined || (isString(file?.name) && isString(file?.mimeType) && file?.blob instanceof Blob);
  return isRequest(data) && textOk && fileOk && !!(data.text || file);
}

/** A well-formed message from the sheet, or undefined. Every field is checked before anything uses it. */
export function parseSheetMessage(data: any): SheetToTab | undefined {
  if(data?.source !== SHEET_SOURCE) return;
  switch(data.type) {
    case 'ready':
    case 'close':
      return {type: data.type};
    case 'resize':
      return Number.isFinite(data.height) ? {type: 'resize', height: data.height} : undefined;
    case 'history-request': {
      const beforeOk = data.before === null || Number.isInteger(data.before);
      return isRequest(data) && beforeOk && Number.isInteger(data.limit) ? data : undefined;
    }
    case 'file-request':
      return isRequest(data) && isString(data.ref) ? data : undefined;
    case 'post-request':
      return isPostRequest(data) ? data : undefined;
  }
}

/** Only messages of one type, typed as that type. */
export function sheetMessage<T extends SheetToTab['type']>(type: T) {
  return (source$: Observable<SheetToTab>) =>
    source$.pipe(filter((message): message is SheetMessageOf<T> => message.type === type));
}

/**
 * The tab's line to its Bleno sheet frame. In: only from that frame's window, from the sheet's origin, with the
 * sheet's `source`. Out: to that frame, with the sheet's origin as the target, so nothing else can read it.
 */
export class SheetChannel {
  public readonly messages$: Observable<SheetToTab>;

  constructor(private frame: HTMLIFrameElement, private origin: string) {
    this.messages$ = fromEvent<MessageEvent>(window, 'message').pipe(
      filter((event) => event.source === this.frame.contentWindow && event.origin === this.origin),
      map((event) => parseSheetMessage(event.data)),
      filter(Boolean),
      share()
    );
  }

  public post(message: TabToSheet) {
    this.frame.contentWindow?.postMessage({source: TAB_SOURCE, ...message}, this.origin);
  }
}
