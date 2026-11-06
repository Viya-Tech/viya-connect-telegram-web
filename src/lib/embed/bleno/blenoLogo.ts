import {blenoLogoUrl} from '@lib/embed/bleno/blenoUrls';
import styles from '@lib/embed/bleno/blenoMode.module.scss';

/** Bleno's mark (near-black; the night themes invert it), decorative: its name is always written beside it. */
export function blenoLogo(className: string) {
  const img = document.createElement('img');
  img.src = blenoLogoUrl();
  img.alt = '';
  img.draggable = false;
  img.classList.add(styles.logo, className);
  return img;
}
