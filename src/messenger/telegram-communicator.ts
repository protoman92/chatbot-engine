import { stringify } from "querystring";
import { HTTPCommunicator } from "../type/communicator";
import { Telegram } from "../type/telegram";

export function createTelegramCommunicator(
  communicator: HTTPCommunicator,
  { authToken, webhookURL }: Telegram.Configs
): Telegram.Communicator {
  function formatURL(action: string, query?: {}) {
    const qs = stringify(query);
    return `https://api.telegram.org/bot${authToken}/${action}?${qs}`;
  }

  async function communicate<Result>(
    ...params: Parameters<HTTPCommunicator["communicate"]>
  ): Promise<Result> {
    const response = await communicator.communicate<
      Telegram.Communicator.APIResponse
    >(...params);

    switch (response.ok) {
      case true:
        return response.result as Result;

      case false:
        throw new Error(response.description);
    }
  }

  return {
    getCurrentBot: () =>
      communicate<Telegram.Bot>({ url: formatURL("getMe"), method: "GET" }),
    isMember: (chat_id, user_id) =>
      communicate<{ status: string }>({
        url: formatURL("getChatMember"),
        method: "GET",
        query: { chat_id, user_id }
      }).then(({ status }) => status === "member"),
    sendResponse: ({ action, ...payload }) => {
      return communicate({
        url: formatURL(action),
        method: "POST",
        body: payload
      });
    },
    // tslint:disable-next-line:variable-name
    setTypingIndicator: async (chat_id, enabled) => {
      /**
       * For Telegram, we don't need to call a separate action to switch off
       * typing. It will be done for us the next time a message arrives.
       */
      if (!enabled) return {};

      return communicate({
        url: formatURL("sendChatAction"),
        method: "POST",
        body: { chat_id, action: "typing" }
      });
    },
    setWebhook: () => {
      return communicate({
        url: formatURL("setWebhook"),
        method: "GET",
        query: { url: webhookURL }
      });
    }
  };
}
