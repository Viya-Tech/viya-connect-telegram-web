import {
  BehaviorSubject, catchError, concatMap, filter, fromEvent, fromEventPattern, map, merge, mergeMap, Observable, of,
  startWith, Subscription, switchMap, take, tap, timer
} from 'rxjs';
import type ChatInput from '@components/chat/input';
import themeController from '@helpers/themeController';
import rootScope from '@lib/rootScope';
import {hostSession$} from '@lib/embed/bridge';
import type {HostSession} from '@lib/embed/types';
import {CARD_FADE_OUT_MS, CARD_MAX_PX, CARD_MAX_SHARE, FILES_PER_REQUEST} from '@lib/embed/bleno/constants';
import {type BlenoChatTarget, chatInfo$, chatMessage$, chatPage$} from '@lib/embed/bleno/chatContext';
import {chatFile$} from '@lib/embed/bleno/chatFile';
import {blenoSheetUrl} from '@lib/embed/bleno/blenoUrls';
import {confirmAndPost$} from '@lib/embed/bleno/postBack';
import {SheetChannel, sheetMessage} from '@lib/embed/bleno/sheetChannel';
import {blenoCall, withoutAtToken} from '@lib/embed/bleno/trigger';
import type {BlenoSession, TabToSheet} from '@lib/embed/bleno/types';
import styles from '@lib/embed/bleno/blenoMode.module.scss';

type Phase = 'closed' | 'open';

const toBlenoSession = (session: HostSession): BlenoSession =>
  session.state === 'signed_in' && session.accessToken ?
    {state: 'signed_in', accessToken: session.accessToken, user: {id: session.userId}} :
    {state: 'signed_out'};

/** Telegram's day or night, now and on every change. */
const theme$ = () => fromEventPattern(
  (handler) => rootScope.addEventListener('theme_changed', handler),
  (handler) => rootScope.removeEventListener('theme_changed', handler)
).pipe(
  startWith(undefined),
  map(() => themeController.isNight() ? 'dark' as const : 'light' as const)
);

/**
 * Bleno mode for one chat input: "@bleno" fades Telegram's input bar out and Bleno's card in where it was. The card
 * is a frame of Bleno's `/sheet` (its header, the talk, and Bleno's own composer, in Bleno's design tokens), and
 * grows up over the chat as the talk grows, to a cap. It's made the first time and kept (hidden) after, so going
 * back and forth never reloads it. More of the chat, a file, a post: all go through here, and a post is always
 * confirmed in Telegram first.
 */
export class BlenoMode {
  private readonly phase$ = new BehaviorSubject<Phase>('closed');
  private card: HTMLDivElement;
  private frame: HTMLIFrameElement;
  private channel: SheetChannel;
  private subscription: Subscription;
  /** Files handed over since the person last asked something (a page of the chat starts a new count). */
  private filesGiven = 0;
  private savedDraft = '';

  constructor(private chatInput: ChatInput) {}

  public get isOpen() {
    return this.phase$.value === 'open';
  }

  /** Telegram's bar fades out, Bleno's card fades in, with `draft` already in Bleno's box. */
  public enter(draft = '') {
    this.build();
    if(!this.isOpen) {
      const field = this.chatInput.messageInputField;
      // * what was typed before "@bl…" comes back on the way out; a whole "@bleno …" call doesn't
      this.savedDraft = blenoCall(field.value) === null ? withoutAtToken(field.value) : '';
      field.value = '';
      this.chatInput.autocompleteHelperController?.hideOtherHelpers();
      this.phase$.next('open');
    }
    this.sendChat();
    if(draft) this.channel.post({type: 'draft', text: draft});
    this.frame.focus();
  }

  /** Back: Bleno's card fades out (quicker than it came), Telegram's bar and draft come back. */
  public leave() {
    if(!this.isOpen) return;
    this.phase$.next('closed');
    this.chatInput.messageInputField.value = this.savedDraft;
    this.chatInput.messageInputField.input.focus();
  }

  /** "Add to Bleno" on a message: opens the card if it's closed and hands Bleno the message (and its file). */
  public add(mid: number) {
    this.enter();
    chatMessage$(this.target(), mid).pipe(
      filter(Boolean),
      take(1)
    ).subscribe((message) => this.channel.post({type: 'added', item: {message}}));
  }

  public destroy() {
    this.subscription?.unsubscribe();
    this.card?.remove();
    this.phase$.complete();
  }

  private target(): BlenoChatTarget {
    const {chat} = this.chatInput;
    return {managers: chat.managers, peerId: chat.peerId, threadId: chat.threadId, myId: rootScope.myId};
  }

  private post = (message: TabToSheet) => this.channel.post(message);

  private sendChat() {
    const target = this.target();
    this.filesGiven = 0;
    chatInfo$(target).pipe(
      switchMap((chat) => chatPage$(target, null).pipe(map((page) => ({chat, page})))),
      take(1)
    ).subscribe(({chat, page}) => this.post({type: 'chat', chat, page}));
  }

  private setHeight(height: number) {
    const chatHeight = this.chatInput.chat.bubbles?.container?.clientHeight;
    const max = chatHeight ? Math.min(CARD_MAX_PX, Math.round(chatHeight * CARD_MAX_SHARE)) : CARD_MAX_PX;
    this.card.style.setProperty('--bleno-card-height', `${Math.min(Math.max(height, 0), max)}px`);
  }

  private build() {
    if(this.card) return;
    const url = blenoSheetUrl();
    const card = this.card = document.createElement('div');
    card.classList.add(styles.card);
    card.dataset.phase = 'closed';

    const frame = this.frame = document.createElement('iframe');
    frame.classList.add(styles.frame);
    frame.title = 'Bleno';
    frame.src = url;
    frame.allow = 'clipboard-write; microphone';
    card.append(frame);

    const {inputContainer, rowsWrapper, btnSendContainer} = this.chatInput;
    inputContainer.classList.add(styles.host);
    const rows = [rowsWrapper.parentElement, btnSendContainer].filter(Boolean);
    rows.forEach((row) => row.classList.add(styles.row));
    inputContainer.append(card);

    this.channel = new SheetChannel(frame, new URL(url).origin);
    this.subscription = merge(this.view$(rows), this.flows$(), this.requests$()).subscribe();
  }

  /** The phase → Telegram's bar and Bleno's card; the card is hidden only once its fade out is over. */
  private view$(rows: HTMLElement[]): Observable<unknown> {
    return this.phase$.pipe(
      tap((phase) => rows.forEach((row) => row.classList.toggle(styles.hiddenRow, phase === 'open'))),
      switchMap((phase) => phase === 'open' ?
        of(phase).pipe(tap(() => {
          this.card.dataset.phase = 'entering';
          requestAnimationFrame(() => this.card.dataset.phase = 'open');
        })) :
        timer(CARD_FADE_OUT_MS).pipe(tap(() => this.card.dataset.phase = 'closed')))
    );
  }

  /** What the tab tells the frame, and the frame's own asks (its height, going back). */
  private flows$(): Observable<unknown> {
    const messages$ = this.channel.messages$;
    const ready$ = messages$.pipe(sheetMessage('ready'), startWith(undefined));

    // * the host's session, again whenever the frame (re)loads; signed out closes Bleno mode
    const session$ = ready$.pipe(
      switchMap(() => hostSession$()),
      map(toBlenoSession),
      tap((session) => {
        this.post({type: 'session', ...session});
        if(session.state === 'signed_out') this.leave();
      })
    );
    const theme = ready$.pipe(switchMap(() => theme$()), tap((value) => this.post({type: 'theme', theme: value})));
    const chat$ = messages$.pipe(sheetMessage('ready'), filter(() => this.isOpen), tap(() => this.sendChat()));
    const resize$ = messages$.pipe(sheetMessage('resize'), tap(({height}) => this.setHeight(height)));
    const close$ = messages$.pipe(sheetMessage('close'), tap(() => this.leave()));

    // * Esc in Telegram goes back too (inside the frame, Bleno sends `close` itself)
    const escape$ = fromEvent<KeyboardEvent>(document, 'keydown', {capture: true}).pipe(
      filter((event) => event.key === 'Escape' && this.isOpen),
      tap((event) => {
        event.stopPropagation();
        this.leave();
      })
    );

    return merge(session$, theme, chat$, resize$, close$, escape$);
  }

  /** The frame's requests: more of the chat, a file, a post. */
  private requests$(): Observable<unknown> {
    const messages$ = this.channel.messages$;
    const history$ = messages$.pipe(
      sheetMessage('history-request'),
      tap(() => this.filesGiven = 0),
      mergeMap(({requestId, before, limit}) => chatPage$(this.target(), before, limit).pipe(
        map((page): TabToSheet => ({type: 'history', requestId, page})),
        catchError(() => of<TabToSheet>({type: 'refused', requestId, reason: 'Couldn’t read more of this chat.'}))
      )),
      tap(this.post)
    );

    // * a file, checked again here, at most FILES_PER_REQUEST between two pages
    const file$ = messages$.pipe(
      sheetMessage('file-request'),
      mergeMap(({requestId, ref}): Observable<TabToSheet> => {
        if(this.filesGiven >= FILES_PER_REQUEST) {
          return of({type: 'refused', requestId, reason: `${FILES_PER_REQUEST} files a question at most.`});
        }
        this.filesGiven += 1;
        return chatFile$(this.target().managers, ref).pipe(
          map((file): TabToSheet => ({type: 'file', requestId, ref, ...file})),
          catchError((error: Error) => {
            this.filesGiven -= 1;
            return of<TabToSheet>({type: 'refused', requestId, reason: error.message});
          })
        );
      }),
      tap(this.post)
    );

    // * one post at a time, each confirmed by the person in Telegram's own dialog
    const post$ = messages$.pipe(
      sheetMessage('post-request'),
      concatMap((request) => confirmAndPost$(this.target(), request).pipe(
        map((ok): TabToSheet => ({type: 'posted', requestId: request.requestId, ok}))
      )),
      tap(this.post)
    );

    return merge(history$, file$, post$);
  }
}

const modes = new WeakMap<ChatInput, BlenoMode>();

/** The Bleno mode of a chat input, made the first time it's asked for. */
export function blenoModeOf(chatInput: ChatInput) {
  let mode = modes.get(chatInput);
  if(!mode) modes.set(chatInput, mode = new BlenoMode(chatInput));
  return mode;
}
