import {defer, from, map, Observable, switchMap, throwError} from 'rxjs';
import type {Message} from '@layer';
import type {MyDocument} from '@appManagers/appDocsManager';
import type {AppManagers} from '@lib/managers';
import appDownloadManager from '@lib/appDownloadManager';
import {FILE_GONE} from '@lib/embed/bleno/constants';
import {fileRefusal} from '@lib/embed/bleno/fileRules';
import type {BlenoChatFile} from '@lib/embed/bleno/types';

/** "<peerId>_<mid>": the tab's own handle for a message's file. */
export const fileRefOf = (message: Message.message) => `${message.peerId}_${message.mid}`;

function documentOf(message: Message.message): MyDocument | undefined {
  const media = message.media;
  return media?._ === 'messageMediaDocument' && media.document?._ === 'document' ? media.document as MyDocument : undefined;
}

/** A message's document, described for Bleno (never its bytes). */
export function describeFile(message: Message.message): BlenoChatFile | undefined {
  const doc = documentOf(message);
  if(!doc) return;
  const name = doc.file_name || 'file';
  const reason = fileRefusal(name, doc.size);
  return {ref: fileRefOf(message), name, mimeType: doc.mime_type, size: doc.size, allowed: !reason, ...(reason && {reason})};
}

export type ChatFileBytes = {name: string, mimeType: string, size: number, blob: Blob};

/** A download as an Observable: unsubscribing cancels it. */
function download$(doc: MyDocument): Observable<Blob> {
  return new Observable<Blob>((subscriber) => {
    const promise = appDownloadManager.downloadMedia({media: doc});
    promise.then((blob) => {
      subscriber.next(blob);
      subscriber.complete();
    }, (error) => subscriber.error(error));
    return () => promise.cancel?.();
  });
}

/** The file's bytes, after the same checks again (the ref could be stale). Errors carry the reason to show. */
export function chatFile$(managers: AppManagers, ref: string): Observable<ChatFileBytes> {
  const [peerId, mid] = ref.split('_');
  return defer(() => from(managers.appMessagesManager.getMessageByPeer(peerId.toPeerId(), Number(mid)))).pipe(
    switchMap((message) => {
      const file = message?._ === 'message' ? describeFile(message) : undefined;
      if(!file) return throwError(() => new Error(FILE_GONE));
      if(!file.allowed) return throwError(() => new Error(file.reason));
      return download$(documentOf(message as Message.message)).pipe(
        map((blob) => ({name: file.name, mimeType: file.mimeType, size: blob.size, blob}))
      );
    })
  );
}
