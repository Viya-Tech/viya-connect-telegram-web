/** Who Viya Connect says is signed in, and the key that unlocks this browser's Telegram tab for them. */
export type ViyaSession = {
  state: 'signed_in',
  userId: string,
  /** The Telegram account linked to them in Signal, null when none is. */
  telegramId: string | null,
  /** null when Viya Connect could not get it: the tab stays locked. */
  tabKey: string | null
} | {
  state: 'signed_out'
};

/** What the Telegram tab tells Viya Connect. */
export type ViyaOutgoing = {
  type: 'ready'
} | {
  /** Telegram ended this tab's session (a log out here, or "terminate sessions" on the phone). */
  type: 'signed-out'
} | {
  /** Signed in to a Telegram account nobody linked yet: Viya Connect offers to link it with this proof. */
  type: 'link-offer',
  initData: string,
  telegram: {id: string, username: string | null, firstName: string}
} | {
  /** Signed in to a Telegram account other than the linked one. */
  type: 'wrong-account'
};
