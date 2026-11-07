import {getOverlayRoot} from '@helpers/appWindow';
import I18n, {i18n, LangPackKey} from '@lib/langPack';
import Button from '@components/button';
import styles from '@components/embed/lockedScreen.module.scss';

/**
 * What covers the tab before it opens:
 * - `opening`: from the first paint until the tab is unlocked, never a blank pane;
 * - `locked`: nobody is signed in to the host app;
 * - `stuck`: a step of opening the saved session took too long (Try again, or reset the tab);
 * - `blocked`: a reset waits for the host app's other tabs to let go of the stored session.
 */
export type LockedScreenView = 'opening' | 'locked' | 'stuck' | 'blocked';

export type LockedScreenActions = {
  onRetry: () => void,
  onReset: () => void
};

const TEXT: Record<LockedScreenView, {title: LangPackKey, text?: LangPackKey}> = {
  opening: {title: 'Embed.Opening.Title'},
  locked: {title: 'Embed.Locked.Title', text: 'Embed.Locked.Text'},
  stuck: {title: 'Embed.Stuck.Title', text: 'Embed.Stuck.Text'},
  blocked: {title: 'Embed.Blocked.Title', text: 'Embed.Blocked.Text'}
};

let element: HTMLElement;

/** Shows the screen (or changes what it says); `actions` give the stuck screen its buttons. */
export function showLockedScreen(view: LockedScreenView = 'locked', actions?: LockedScreenActions) {
  if(!element) {
    // * it shows before Web K's own start-up has applied the language pack
    I18n.getCacheLangPackAndApply().catch(() => {});
    element = document.createElement('div');
    element.classList.add('passcode-lock-screen', styles.screen);
    element.setAttribute('role', 'status');
    getOverlayRoot().append(element);
  }

  const {title, text} = TEXT[view];
  const heading = document.createElement('h1');
  heading.classList.add(styles.title);
  heading.append(i18n(title));
  const parts: HTMLElement[] = [heading];

  if(text) {
    const line = document.createElement('p');
    line.classList.add(styles.text);
    line.append(i18n(text));
    parts.push(line);
  }

  if(view === 'stuck' && actions) {
    const retry = Button('btn-primary btn-color-primary', {text: 'Embed.Stuck.Retry'});
    retry.addEventListener('click', actions.onRetry);
    const reset = Button(`btn-primary btn-transparent ${styles.secondary}`, {text: 'Embed.Stuck.Reset'});
    reset.addEventListener('click', actions.onReset);
    const row = document.createElement('div');
    row.classList.add(styles.actions);
    row.append(retry, reset);
    parts.push(row);
  }

  element.dataset.view = view;
  element.replaceChildren(...parts);
}

export function hideLockedScreen() {
  element?.remove();
  element = undefined;
}
