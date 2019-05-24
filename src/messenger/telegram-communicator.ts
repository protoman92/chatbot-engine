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

  async function communicate(
    ...params: Parameters<HTTPCommunicator['communicate']>
  ): Promise<unknown> {
    const response = await communicator.communicate<
      Telegram.Communicator.APIResponse
    >(...params);

    switch (response.ok) {
      case true:
        return response.result;

      case false:
        throw new Error(response.description);
    }
  }

  return {
    getUser: async <U>() => ({} as U),
    sendResponse: ({ action, ...payload }) => {
      return communicate({
        url: formatURL(action),
        method: 'POST',
        body: payload
      });
    },
    // tslint:disable-next-line:variable-name
    setTypingIndicator: async chat_id => {
      return communicate({
        url: formatURL('sendChatAction'),
        method: 'POST',
        body: { chat_id, action: 'typing' }
      });
    },
    setWebhook: () => {
      return communicate({
        url: formatURL('setWebhook'),
        method: 'GET',
        query: { url: webhookURL }
      });
    }
  };
}
