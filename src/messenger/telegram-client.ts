import { stringify } from "querystring";
import { requireAllTruthy } from "../common/utils";
import { HTTPClient } from "../type/client";
import {
  TelegramBot,
  TelegramClient,
  TelegramConfigs,
  TelegramRawRequest,
} from "../type/telegram";
import defaultAxiosClient from "./axios-client";

export function createTelegramClient(
  client: HTTPClient,
  { authToken, webhookURL }: TelegramConfigs
): TelegramClient {
  function formatURL(action: string, query?: {}) {
    const qs = stringify(query);
    return `https://api.telegram.org/bot${authToken}/${action}?${qs}`;
  }

  async function communicate<Result>(
    ...params: Parameters<HTTPClient["communicate"]>
  ): Promise<Result> {
    const response = await client.communicate<TelegramClient.APIResponse>(
      ...params
    );

    switch (response.ok) {
      case true:
        return response.result as Result;

      case false:
        throw new Error(response.description);
    }
  }

  return {
    getCurrentBot: () =>
      communicate<TelegramBot>({ url: formatURL("getMe"), method: "GET" }),
    getFile: (file_id) =>
      communicate<TelegramRawRequest.FileDetails>({
        url: formatURL("getFile"),
        method: "GET",
        query: { file_id },
      }),
    getFileURL: async (filePath) => formatURL(filePath),
    isMember: (chat_id, user_id) =>
      communicate<{ status: string }>({
        url: formatURL("getChatMember"),
        method: "GET",
        query: { chat_id, user_id },
      }).then(({ status }) => status === "member"),
    sendResponse: ({ action, ...payload }) => {
      return communicate({
        url: formatURL(action),
        method: "POST",
        body: payload,
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
        body: { chat_id, action: "typing" },
      });
    },
    setWebhook: () => {
      return communicate({
        url: formatURL("setWebhook"),
        method: "GET",
        query: { url: webhookURL },
      });
    },
  };
}

export default function() {
  const { TELEGRAM_AUTH_TOKEN = "", TELEGRAM_WEBHOOK_URL = "" } = process.env;

  const {
    TELEGRAM_AUTH_TOKEN: authToken,
    TELEGRAM_WEBHOOK_URL: webhookURL,
  } = requireAllTruthy({
    TELEGRAM_AUTH_TOKEN,
    TELEGRAM_WEBHOOK_URL,
  });

  return createTelegramClient(defaultAxiosClient, {
    authToken,
    webhookURL,
  });
}
