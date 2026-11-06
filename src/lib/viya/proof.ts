import {bindManagersToSession} from '@lib/accounts/bindManagersToAccount';
import rootScope from '@lib/rootScope';
import {VIYA_BOT_USERNAME, WEB_APP_DATA_PARAM} from '@lib/viya/constants';

export type ViyaProof = {
  initData: string,
  telegram: {id: string, username: string | null, firstName: string}
};

/**
 * The proof Telegram signs for our bot's main mini app, the same one a Telegram app gets when it opens it. Signal
 * checks it with the bot token, so Viya Connect never has to trust "I'm Telegram user X" from this tab. Undefined
 * when the bot isn't set, can't be found, or has no main mini app.
 */
export async function requestViyaProof(): Promise<ViyaProof> {
  if(!VIYA_BOT_USERNAME) return;

  const managers = bindManagersToSession(rootScope.managers);
  const bot = await managers.appUsersManager.resolveUserByUsername(VIYA_BOT_USERNAME).catch((): undefined => undefined);
  if(!bot) return;

  const result = await managers.appAttachMenuBotsManager.requestWebView({
    botId: bot.id,
    peerId: bot.id.toPeerId(false),
    main: true
  }).catch((): undefined => undefined);

  const url = result && 'url' in result ? result.url : undefined;
  if(!url) return;

  const initData = new URLSearchParams(new URL(url).hash.slice(1)).get(WEB_APP_DATA_PARAM);
  const user = initData && readUser(initData);
  if(!user) return;

  return {initData, telegram: user};
}

function readUser(initData: string): ViyaProof['telegram'] {
  try {
    const user = JSON.parse(new URLSearchParams(initData).get('user'));
    if(typeof user?.id !== 'number') return;
    return {id: String(user.id), username: user.username ?? null, firstName: user.first_name ?? ''};
  } catch(err) {
    return;
  }
}
