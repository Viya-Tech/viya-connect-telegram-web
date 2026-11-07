import type ListenerSetter from '@helpers/listenerSetter';
import {TYPED_INPUT_WINDOW_MS} from '@lib/embed/bleno/constants';

/** Remembers when the browser last said the person typed; a change soon after counts as typed. */
export function typingClock() {
  let typedAt = Number.NEGATIVE_INFINITY;
  return {
    mark: (event: Pick<Event, 'isTrusted'>) => {
      if(event.isTrusted) typedAt = performance.now();
    },
    typed: () => performance.now() - typedAt < TYPED_INPUT_WINDOW_MS
  };
}

/**
 * Whether the message box's latest change was typed by the person. The box's editor swallows the browser's own
 * (trusted) `input` event and sends every change again as its own event, which it marks as typed only when
 * ProseMirror commits the change before a microtask has passed; it usually commits later, so a typed "@bleno "
 * reached the input bar unmarked and never opened Bleno. The trusted event is caught here instead, on its way down
 * to the editor (capture, on an element around it).
 */
export function watchTyping(around: HTMLElement, listenerSetter: ListenerSetter) {
  const clock = typingClock();
  listenerSetter.add(around)('input', clock.mark, {capture: true});
  return clock.typed;
}
