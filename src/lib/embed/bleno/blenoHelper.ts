import AutocompleteHelper from '@components/chat/autocompleteHelper';
import type AutocompleteHelperController from '@components/chat/autocompleteHelperController';
import type ChatInput from '@components/chat/input';
import I18n, {i18n} from '@lib/langPack';
import {blenoLogo} from '@lib/embed/bleno/blenoLogo';
import {blenoModeOf} from '@lib/embed/bleno/blenoMode';
import {offersBleno} from '@lib/embed/bleno/trigger';
import styles from '@lib/embed/bleno/blenoMode.module.scss';

const BASE = 'autocomplete-peer-helper-list-element';

/**
 * The @ list's row for Bleno while "@bl…" is typed at the start of a message: built like a mention's row
 * (picture, name, what it does), so it sits in the list as one of its own.
 */
export default class BlenoHelper extends AutocompleteHelper {
  constructor(appendTo: HTMLElement, controller: AutocompleteHelperController, private chatInput: ChatInput) {
    super({
      appendTo,
      controller,
      listType: 'y',
      onSelect: () => {
        this.toggle(true);
        blenoModeOf(this.chatInput).enter();
        return true;
      }
    });
    this.container.classList.add('autocomplete-peer-helper', 'bleno-helper', styles.helper);
    this.container.setAttribute('role', 'listbox');
    this.container.setAttribute('aria-label', I18n.format('Bleno.Name', true));
  }

  public init() {
    this.list = document.createElement('div');
    this.list.classList.add('autocomplete-peer-helper-list');
    this.container.append(this.list);
  }

  private row() {
    const row = document.createElement('div');
    row.classList.add(BASE);
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');

    const avatar = document.createElement('div');
    avatar.classList.add(`${BASE}-avatar`, styles.avatar);
    avatar.append(blenoLogo(styles.avatarLogo));

    const name = document.createElement('div');
    name.classList.add(`${BASE}-name`);
    name.append(i18n('Bleno.Name'));

    const description = document.createElement('div');
    description.classList.add(`${BASE}-description`);
    description.append(i18n('Bleno.Suggest.Hint'));

    const hint = document.createElement('div');
    hint.classList.add(styles.hint);
    hint.append(i18n('Bleno.Suggest.Enter'));

    row.append(avatar, name, description, hint);
    return row;
  }

  /** Shows the row for a query that could still become "@bleno"; false hands the @ to the mentions. */
  public checkQuery(query: string, fromStart: boolean) {
    const offered = offersBleno(query, fromStart);
    if(offered) {
      if(this.init) {
        this.init();
        this.init = null;
      }
      this.list.replaceChildren(this.row());
    }
    this.toggle(!offered);
    return offered;
  }
}
