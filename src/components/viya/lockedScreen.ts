import {getOverlayRoot} from '@helpers/appWindow';
import I18n, {i18n} from '@lib/langPack';
import styles from '@components/viya/lockedScreen.module.scss';

let element: HTMLElement;

/** Covers the tab while nobody is signed in to Viya Connect, or while the tab is being wiped. */
export function showViyaLockedScreen() {
  if(element) return;

  // * it shows before Web K's own start-up has applied the language pack
  I18n.getCacheLangPackAndApply().catch(() => {});

  element = document.createElement('div');
  element.classList.add('passcode-lock-screen', styles.screen);
  element.setAttribute('role', 'status');

  const title = document.createElement('h1');
  title.classList.add(styles.title);
  title.append(i18n('Viya.Locked.Title'));

  const text = document.createElement('p');
  text.classList.add(styles.text);
  text.append(i18n('Viya.Locked.Text'));

  element.append(title, text);
  getOverlayRoot().append(element);
}

export function hideViyaLockedScreen() {
  element?.remove();
  element = undefined;
}
