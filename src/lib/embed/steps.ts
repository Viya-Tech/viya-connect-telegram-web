import {EMBED_STEP_TIMEOUT_MS} from '@lib/embed/constants';

/** Each step of opening the tab, in the console: a pasted log says where it stopped. */
export function embedLog(step: string, what: string) {
  console.info(`[EMBED] ${step}: ${what}`);
}

export class EmbedStepTimeout extends Error {
  constructor(public step: string) {
    super(`${step} took longer than ${EMBED_STEP_TIMEOUT_MS / 1000} s`);
  }
}

/** A step with a time limit: its result, or `EmbedStepTimeout` once it has waited too long (it may still finish). */
export function timedStep<T>(step: string, run: () => Promise<T>, ms = EMBED_STEP_TIMEOUT_MS): Promise<T> {
  embedLog(step, 'start');
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      embedLog(step, `no answer after ${ms} ms`);
      reject(new EmbedStepTimeout(step));
    }, ms);
    run().then(
      (value) => {
        clearTimeout(timer);
        embedLog(step, 'done');
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        embedLog(step, `failed: ${err instanceof Error ? err.message : String(err)}`);
        reject(err);
      }
    );
  });
}
