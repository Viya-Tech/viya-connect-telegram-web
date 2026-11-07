import {afterEach, describe, expect, it, vi} from 'vitest';
import {EMBED_DATABASE, EMBED_STEP_TIMEOUT_MS, EMBED_STORAGE_KEY} from '@lib/embed/constants';
import {EmbedStepTimeout, timedStep} from '@lib/embed/steps';

describe('Embedded tab: opening steps', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives a step that answers its result', async() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(timedStep('settings', async() => true)).resolves.toBe(true);
  });

  it('gives up on a step that never answers, naming it', async() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const never = timedStep('unlock', () => new Promise<void>(() => {}));
    const caught = never.catch((err) => err);
    vi.advanceTimersByTime(EMBED_STEP_TIMEOUT_MS);
    const err = await caught;
    expect(err).toBeInstanceOf(EmbedStepTimeout);
    expect((err as EmbedStepTimeout).step).toBe('unlock');
  });

  it('logs each step with the [EMBED] prefix', async() => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await timedStep('key', async() => false);
    expect(info).toHaveBeenCalledWith('[EMBED] key: start');
    expect(info).toHaveBeenCalledWith('[EMBED] key: done');
  });
});

describe('Embedded tab: what a reset clears', () => {
  it('only Web K\'s own databases', () => {
    for(const name of ['telegram', 'tweb', 'tweb-common', 'tweb-account-2']) expect(EMBED_DATABASE.test(name)).toBe(true);
    for(const name of ['bleno-db', 'tweb-other', 'host']) expect(EMBED_DATABASE.test(name)).toBe(false);
  });

  it('only Web K\'s own keys, never the host app\'s', () => {
    for(const key of ['dc', 'user_auth', 'dc2_auth_key', 't_dc', 'account1', 'encryption_key', 'k_build']) {
      expect(EMBED_STORAGE_KEY.test(key)).toBe(true);
    }
    for(const key of ['viya:app-windows:v1', 'bleno:draft', 'dcx', 'theme']) expect(EMBED_STORAGE_KEY.test(key)).toBe(false);
  });
});
