import { HTTPCommunicator, PlatformCommunicator } from '../type/communicator';
import { TelegramConfigs, TelegramResponse } from '../type/telegram';

export function createTelegramCommunicator(
  communicator: HTTPCommunicator,
  { authToken }: TelegramConfigs
): PlatformCommunicator<TelegramResponse> {
  function formatURL(action: string) {
    return `https://api.telegram.org/bot${authToken}/${action}`;
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
    }
  };
}
