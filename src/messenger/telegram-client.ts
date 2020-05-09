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
  { authToken, defaultParseMode, webhookURL }: TelegramConfigs
): TelegramClient {
  function formatURL(action: string, query?: {}) {
    let qs = stringify(query);
    qs = !!qs.length ? `?${qs}` : "";
    return `https://api.telegram.org/bot${authToken}/${action}${qs}`;
  }

  function formatFileURL(filePath: string) {
    return `https://api.telegram.org/file/bot${authToken}/${filePath}`;
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

  const telegramClient: TelegramClient = {
    getCurrentBot: () =>
      communicate<TelegramBot>({ url: formatURL("getMe"), method: "GET" }),
    getFile: (file_id) =>
      communicate<TelegramRawRequest.FileDetails>({
        url: formatURL("getFile"),
        method: "GET",
        query: { file_id },
      }),
    getFileURL: async (filePath) => formatFileURL(filePath),
    getFileURLFromID: async (fileID) => {
      const { file_path } = await telegramClient.getFile(fileID);
      const fileURL = await telegramClient.getFileURL(file_path);
      console.log(fileURL);
      return fileURL;
    },
    isMember: (chat_id, user_id) =>
      communicate<{ status: string }>({
        url: formatURL("getChatMember"),
        method: "GET",
        query: { chat_id, user_id },
      }).then(({ status }) => status === "member"),
    sendResponse: ({
      action,
      parseMode: parse_mode = defaultParseMode,
      ...payload
    }) => {
      return communicate({
        url: formatURL(action, { parse_mode }),
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

  return telegramClient;
}

export default function(args?: Pick<TelegramConfigs, "defaultParseMode">) {
  const { TELEGRAM_AUTH_TOKEN = "", TELEGRAM_WEBHOOK_URL = "" } = process.env;

  const {
    TELEGRAM_AUTH_TOKEN: authToken,
    TELEGRAM_WEBHOOK_URL: webhookURL,
  } = requireAllTruthy({
    TELEGRAM_AUTH_TOKEN,
    TELEGRAM_WEBHOOK_URL,
  });

  return createTelegramClient(defaultAxiosClient, {
    ...args,
    authToken,
    webhookURL,
  });
}
