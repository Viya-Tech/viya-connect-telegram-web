import {describe, expect, it, vi} from 'vitest';
import {blenoCall, offersBleno, withoutAtToken} from '@lib/embed/bleno/trigger';
import {fileRefusal} from '@lib/embed/bleno/fileRules';
import {parseSheetMessage} from '@lib/embed/bleno/sheetChannel';
import {FILE_MAX_BYTES, FILE_TOO_BIG, FILE_TYPE_REFUSED, TYPED_INPUT_WINDOW_MS} from '@lib/embed/bleno/constants';
import {typingClock, watchTyping} from '@lib/embed/bleno/typedInput';
import ListenerSetter from '@helpers/listenerSetter';

describe('Bleno trigger', () => {
  it('offers Bleno for "@bl…" at the start only', () => {
    expect(offersBleno('@bl', true)).toBe(true);
    expect(offersBleno('@BLENO', true)).toBe(true);
    expect(offersBleno('@b', true)).toBe(false);
    expect(offersBleno('@bla', true)).toBe(false);
    expect(offersBleno('@bl', false)).toBe(false);
  });

  it('reads the question out of "@bleno …"', () => {
    expect(blenoCall('@bleno what is late?')).toBe('what is late?');
    expect(blenoCall('@Bleno ')).toBe('');
    expect(blenoCall('@blenox hi')).toBe(null);
    expect(blenoCall('hi @bleno there')).toBe(null);
  });

  it('gives back the draft without the @ being typed', () => {
    expect(withoutAtToken('see this @bl')).toBe('see this');
    expect(withoutAtToken('@bl')).toBe('');
  });
});

describe('Bleno typing', () => {
  it('counts a change as typed only shortly after the browser\'s own input event', () => {
    vi.useFakeTimers();
    const clock = typingClock();
    expect(clock.typed()).toBe(false);
    // * the editor's re-sent event is not the person's
    clock.mark({isTrusted: false});
    expect(clock.typed()).toBe(false);
    clock.mark({isTrusted: true});
    expect(clock.typed()).toBe(true);
    vi.advanceTimersByTime(TYPED_INPUT_WINDOW_MS);
    expect(clock.typed()).toBe(false);
    vi.useRealTimers();
  });

  it('ignores events a script sends the message box', () => {
    const around = document.createElement('div');
    const field = document.createElement('div');
    around.append(field);
    const listenerSetter = new ListenerSetter();
    const typed = watchTyping(around, listenerSetter);
    field.dispatchEvent(new Event('input', {bubbles: true}));
    expect(typed()).toBe(false);
    listenerSetter.removeAll();
  });
});

describe('Bleno files', () => {
  it('takes small spreadsheets and documents only', () => {
    expect(fileRefusal('boq.xlsx', 1000)).toBe(undefined);
    expect(fileRefusal('Report.PDF', 1000)).toBe(undefined);
    expect(fileRefusal('big.csv', FILE_MAX_BYTES + 1)).toBe(FILE_TOO_BIG);
    expect(fileRefusal('setup.exe', 10)).toBe(FILE_TYPE_REFUSED);
    expect(fileRefusal('noextension', 10)).toBe(FILE_TYPE_REFUSED);
  });
});

describe('Bleno sheet messages', () => {
  const from = (data: object) => parseSheetMessage({source: 'bleno-sheet', ...data});

  it('drops anything without the sheet\'s source or with bad fields', () => {
    expect(parseSheetMessage({source: 'host', type: 'ready'})).toBe(undefined);
    expect(from({type: 'resize', height: 'tall'})).toBe(undefined);
    expect(from({type: 'history-request', requestId: 'a', before: 'x', limit: 50})).toBe(undefined);
    expect(from({type: 'file-request', ref: '1_2'})).toBe(undefined);
    expect(from({type: 'post-request', requestId: 'a'})).toBe(undefined);
    expect(from({type: 'post-request', requestId: 'a', text: 'x'.repeat(5000)})).toBe(undefined);
    expect(from({type: 'whatever'})).toBe(undefined);
  });

  it('keeps well-formed requests', () => {
    expect(from({type: 'ready'})).toEqual({type: 'ready'});
    expect(from({type: 'history-request', requestId: 'a', before: null, limit: 50})?.type).toBe('history-request');
    expect(from({type: 'file-request', requestId: 'a', ref: '1_2'})?.type).toBe('file-request');
    expect(from({type: 'post-request', requestId: 'a', text: 'Done'})?.type).toBe('post-request');
  });
});
