import {getOverlayRoot} from '@helpers/appWindow';
import I18n, {i18n} from '@lib/langPack';
import styles from '@components/embed/lockedScreen.module.scss';

let element: HTMLElement;

/** Covers the tab while nobody is signed in to the host app, or while the tab is being wiped. */
export function showLockedScreen() {
  if(element) return;

  // * it shows before Web K's own start-up has applied the language pack
  I18n.getCacheLangPackAndApply().catch(() => {});

  element = document.createElement('div');
  element.classList.add('passcode-lock-screen', styles.screen);
  element.setAttribute('role', 'status');

  const title = document.createElement('h1');
  title.classList.add(styles.title);
  title.append(i18n('Embed.Locked.Title'));

  const text = document.createElement('p');
  text.classList.add(styles.text);
  text.append(i18n('Embed.Locked.Text'));

  element.append(title, text);
  getOverlayRoot().append(element);
}

export function hideLockedScreen() {
  element?.remove();
  element = undefined;
}
