/** Who the host app says is signed in, and the key that unlocks this browser's Telegram tab for them. */
export type HostSession = {
  state: 'signed_in',
  userId: string,
  /** The Telegram account linked to them in the host app, null when none is. */
  telegramId: string | null,
  /** null when the host app could not get it: the tab stays locked. */
  tabKey: string | null,
  /** The host's access token, for Bleno's sheet. Memory only, replaced on every refresh. */
  accessToken: string | null
} | {
  state: 'signed_out'
};

/** What the Telegram tab tells the host app. */
export type HostOutgoing = {
  type: 'ready'
} | {
  /** Telegram ended this tab's session (a log out here, or "terminate sessions" on the phone). */
  type: 'signed-out'
} | {
  /** Signed in to a Telegram account nobody linked yet: the host app offers to link it with this proof. */
  type: 'link-offer',
  initData: string,
  telegram: {id: string, username: string | null, firstName: string}
} | {
  /** Signed in to a Telegram account other than the linked one. */
  type: 'wrong-account'
};
