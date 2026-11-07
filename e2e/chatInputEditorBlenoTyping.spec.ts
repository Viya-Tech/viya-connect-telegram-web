import {expect} from '@playwright/test';
import {openEditor} from './fixtures/chatInputEditorTest';
import {test} from './workerContext';
// * TYPED_INPUT_WINDOW_MS in src/lib/embed/bleno/constants.ts (that file reads import.meta.env, which a spec can't)
const TYPED_INPUT_WINDOW_MS = 1000;

/*
 * The embedded build opens Bleno when "@bleno " is typed at the start of a message (src/lib/embed/bleno/typedInput.ts).
 * It can't go by the editor's own input event: that comes untrusted and, for typing, unmarked as the person's. It goes
 * by the browser's trusted event, caught on its way down to the editor, shortly before the editor's. This pins both.
 */
test('typing reaches an element around the editor as a trusted input, shortly before the editor sends the change', async({page}) => {
  await openEditor(page);
  await page.evaluate(() => {
    const w = window as unknown as {heard: {trusted: boolean, typed: boolean, text: string, at: number}[]};
    w.heard = [];
    const field = document.querySelector('#editor')!;
    field.parentElement!.addEventListener('input', (event) => {
      w.heard.push({trusted: event.isTrusted, typed: false, text: '', at: performance.now()});
    }, {capture: true});
    field.addEventListener('input', (event) => {
      w.heard.push({
        trusted: event.isTrusted,
        typed: !!(event as Event & {chatInputEditorUserInput?: true}).chatInputEditorUserInput,
        text: window.chatInputEditorHarness.value().value,
        at: performance.now()
      });
    });
  });
  await page.locator('#editor').click();
  await page.keyboard.type('@bleno ');

  type Heard = {trusted: boolean, typed: boolean, text: string, at: number};
  await expect.poll(() => page.evaluate(() => (window as unknown as {heard: Heard[]}).heard.slice(-1)[0]?.text)).toBe('@bleno ');
  const heard = await page.evaluate(() => (window as unknown as {heard: Heard[]}).heard);
  const sent = heard[heard.length - 1];
  const typedBefore = heard.filter((h) => h.trusted && h.at <= sent.at).pop();
  expect(sent.trusted).toBe(false);
  expect(typedBefore).toBeDefined();
  expect(sent.at - typedBefore!.at).toBeLessThan(TYPED_INPUT_WINDOW_MS);
});
