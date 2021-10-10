import { stringify } from "querystring";
import { requireAllTruthy } from "../common/utils";
import {
  HTTPClient,
  TelegramBot,
  TelegramClient,
  TelegramConfig,
  _TelegramClient,
  _TelegramRawRequest,
} from "../type";
import defaultAxiosClient from "./axios-client";

export function createTelegramClient(
  client: HTTPClient,
  { authToken, defaultParseMode }: TelegramConfig
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
    const response = await client.communicate<_TelegramClient.APIResponse>(
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
      communicate<_TelegramRawRequest.FileDetails>({
        url: formatURL("getFile"),
        method: "GET",
        query: { file_id },
      }),
    getFileURL: async (filePath) => formatFileURL(filePath),
    getFileURLFromID: async (fileID) => {
      const { file_path } = await telegramClient.getFile(fileID);
      const fileURL = await telegramClient.getFileURL(file_path);
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
      body,
      headers = {},
      parseMode: parse_mode = defaultParseMode,
    }) => {
      return communicate({
        body,
        headers,
        url: formatURL(action, { parse_mode }),
        method: "POST",
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
    setWebhook: (webhookURL) => {
      return communicate({
        url: formatURL("setWebhook"),
        method: "GET",
        query: { url: webhookURL },
      });
    },
  };

  return telegramClient;
}

export default function (args?: Pick<TelegramConfig, "defaultParseMode">) {
  const { TELEGRAM_AUTH_TOKEN: authToken } = requireAllTruthy({
    TELEGRAM_AUTH_TOKEN: process.env.TELEGRAM_AUTH_TOKEN,
  });

  return createTelegramClient(defaultAxiosClient, { ...args, authToken });
}
