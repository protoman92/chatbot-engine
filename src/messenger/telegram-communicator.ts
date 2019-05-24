import { stringify } from 'querystring';
import { HTTPCommunicator } from '../type/communicator';
import { Telegram } from '../type/telegram';

export function createTelegramCommunicator(
  communicator: HTTPCommunicator,
  { authToken, webhookURL }: Telegram.Configs
): Telegram.Communicator {
  function formatURL(action: string, query?: {}) {
    const qs = stringify(query);
    return `https://api.telegram.org/bot${authToken}/${action}?${qs}`;
  }

  return {
    getUser: async <U>() => ({} as U),
    sendResponse: ({ action, ...payload }) => {
      return communicator.communicate({
        url: formatURL(action),
        method: 'POST',
        body: payload
      });
    },
    // tslint:disable-next-line:variable-name
    setTypingIndicator: async chat_id => {
      return communicator.communicate({
        url: formatURL('sendChatAction'),
        method: 'POST',
        body: { chat_id, action: 'typing' }
      });
    },
    setWebhook: () => {
      return communicator.communicate({
        url: formatURL('setWebhook'),
        method: 'GET',
        query: { url: webhookURL }
      });
    }
  };
}
