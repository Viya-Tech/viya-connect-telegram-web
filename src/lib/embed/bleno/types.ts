/** A file in the chat. `ref` is the tab's own handle for it; Bleno asks for the bytes by it. */
export type BlenoChatFile = {
  ref: string,
  name: string,
  mimeType: string,
  size: number,
  /** False when it's too big or not a type Bleno reads: listed, never sent. */
  allowed: boolean,
  reason?: string
};

/** One chat message, as Bleno sees it. */
export type BlenoChatMessage = {
  /** The message's id in this chat, so Bleno can point at it. */
  id: number,
  /** The sender's name, or "You". */
  sender: string,
  /** Unix seconds. */
  date: number,
  text: string,
  replyTo?: number,
  files?: BlenoChatFile[]
};

/** A stretch of the chat, oldest first. `before` asks for the one before it; null when there's no more. */
export type BlenoChatPage = {
  messages: BlenoChatMessage[],
  before: number | null
};

export type BlenoChatInfo = {
  /** Stable for this chat, so the sheet keeps one conversation per chat. */
  key: string,
  title: string,
  kind: 'private' | 'group' | 'channel'
};

/** What the person picked with "Add to Bleno" on a message. */
export type BlenoAddedItem = {
  message: BlenoChatMessage
};

export type BlenoSession =
  | {state: 'signed_in', accessToken: string, user: {id: string}}
  | {state: 'signed_out'};

/** The tab → the sheet. */
export type TabToSheet =
  | ({type: 'session'} & BlenoSession)
  | {type: 'theme', theme: 'light' | 'dark'}
  | {type: 'chat', chat: BlenoChatInfo, page: BlenoChatPage}
  /** "@bleno what's late?": the question, for Bleno's own box. */
  | {type: 'draft', text: string}
  | {type: 'added', item: BlenoAddedItem}
  | {type: 'history', requestId: string, page: BlenoChatPage}
  | {type: 'file', requestId: string, ref: string, name: string, mimeType: string, size: number, blob: Blob}
  | {type: 'refused', requestId: string, reason: string}
  | {type: 'posted', requestId: string, ok: boolean};

/** The sheet → the tab. */
export type SheetToTab =
  | {type: 'ready'}
  | {type: 'resize', height: number}
  | {type: 'close'}
  | {type: 'history-request', requestId: string, before: number | null, limit: number}
  | {type: 'file-request', requestId: string, ref: string}
  | {type: 'post-request', requestId: string, text?: string, file?: {name: string, mimeType: string, blob: Blob}};

export type SheetMessageOf<T extends SheetToTab['type']> = Extract<SheetToTab, {type: T}>;
