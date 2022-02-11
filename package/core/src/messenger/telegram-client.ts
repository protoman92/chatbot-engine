import {
  requireAllTruthy,
  requireTruthy,
} from "@haipham/javascript-helper-preconditions";
import { stringify } from "querystring";
import { telegramError } from "../common/utils";
import {
  HTTPClient,
  TelegramBot,
  TelegramClient,
  TelegramConfig,
  TelegramRawRequest,
  _TelegramClient,
  _TelegramRawRequest,
} from "../type";
import defaultAxiosClient from "./axios-client";

export function createTelegramClient(
  client: HTTPClient,
  {
    authToken,
    defaultParseMode,
    defaultPaymentProviderToken: paymentProviderToken,
  }: TelegramConfig
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
    ...params: Parameters<HTTPClient["requestWithErrorCapture"]>
  ): Promise<Result> {
    const response = await client.requestWithErrorCapture<
      _TelegramClient.APIResponse.Success<Result>,
      _TelegramClient.APIResponse.Failure
    >(...params);

    if (response.data != null) {
      return response.data.result;
    } else {
      throw new Error(response.error.description);
    }
  }

  const telegramClient: TelegramClient = {
    deleteMessage: ({ chatID: chat_id, messageID: message_id }) => {
      return communicate({
        method: "GET",
        query: { chat_id, message_id },
        url: formatURL("deleteMessage"),
      });
    },
    getCurrentBot: () => {
      return communicate<TelegramBot>({
        url: formatURL("getMe"),
        method: "GET",
      });
    },
    getFile: (file_id) => {
      return communicate<_TelegramRawRequest.FileDetails>({
        url: formatURL("getFile"),
        method: "GET",
        query: { file_id },
      });
    },
    getFileURL: async (filePath) => {
      return formatFileURL(filePath);
    },
    getFileURLFromID: async (fileID) => {
      const { file_path } = await telegramClient.getFile(fileID);
      const fileURL = await telegramClient.getFileURL(file_path);
      return fileURL;
    },
    isMember: ({ chatID: chat_id, botID: user_id }) => {
      return communicate<{ status: string }>({
        url: formatURL("getChatMember"),
        method: "GET",
        query: { chat_id, user_id },
      }).then(({ status }) => {
        return status === "member";
      });
    },
    sendResponse: ({
      action,
      body,
      headers = {},
      parseMode: parse_mode = defaultParseMode,
    }) => {
      return communicate<TelegramRawRequest>({
        headers,
        body: {
          ...body,
          ...(action === "sendInvoice"
            ? {
                provider_token: requireTruthy(
                  paymentProviderToken,
                  telegramError("Payment provider token must be provided.")
                    .message
                ),
              }
            : {}),
        },
        url: formatURL(action, { parse_mode }),
        method: "POST",
      });
    },
    setTypingIndicator: async (chat_id, enabled) => {
      /**
       * For Telegram, we don't need to call a separate action to switch off
       * typing. It will be done for us the next time a message arrives.
       */
      if (!enabled) {
        return {};
      }

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

export default function createDefaultTelegramClient(
  args?: Pick<
    TelegramConfig,
    "defaultParseMode" | "defaultPaymentProviderToken"
  >
) {
  const { TELEGRAM_AUTH_TOKEN: authToken } = requireAllTruthy({
    TELEGRAM_AUTH_TOKEN: process.env["TELEGRAM_AUTH_TOKEN"],
  });

  return createTelegramClient(defaultAxiosClient, { ...args, authToken });
}
