import {FILE_EXTENSION, FILE_EXTENSIONS, FILE_MAX_BYTES, FILE_TOO_BIG, FILE_TYPE_REFUSED} from '@lib/embed/bleno/constants';

/** Why a file can't go to Bleno, or undefined when it can: small spreadsheets and documents only. */
export function fileRefusal(name: string, size: number): string | undefined {
  const extension = FILE_EXTENSION.exec(name)?.[1]?.toLowerCase();
  if(!extension || !FILE_EXTENSIONS.has(extension)) return FILE_TYPE_REFUSED;
  if(size > FILE_MAX_BYTES) return FILE_TOO_BIG;
}
