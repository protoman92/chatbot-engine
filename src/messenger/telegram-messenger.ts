import { Omit } from "ts-essentials";
import { DEFAULT_COORDINATES, isType, telegramError } from "../common/utils";
import { Transformer } from "../type/common";
import { LeafSelector } from "../type/leaf";
import {
  TelegramBot,
  TelegramClient,
  TelegramMessageProcessor,
  TelegramRawRequest,
  TelegramRawResponse,
  TelegramRequest,
  TelegramResponse,
  TelegramResponseOutput,
  TelegramUser,
} from "../type/telegram";
import { BaseResponseOutput } from "../type/visual-content";
import { createMessageProcessor } from "./generic-messenger";

/**
 * Extract an input command from an input text. For example:
 * /start @abcbot 123
 * should give [start, 123], i.e. the command and the instruction. If the
 * command does not exist, fallback to the base input text for instruction.
 */
export function extractInputCommand(
  username: string,
  inputText: string
): [string, string] {
  const usernamePing = `@${username}`;

  if (inputText.includes(usernamePing)) {
    /** In this case, the bot is in a group, so it needs to be pinged */
    const [, command = "", text = inputText] =
      inputText.match(
        new RegExp(`^\\/\(\\w*\)\\s*${usernamePing}\\s*\(\(.|\\s\)*\)$`, "im")
      ) || [];

    return [command.trim(), text.trim()];
  } else {
    const [, command = "", text = inputText] =
      inputText.match(new RegExp(`^\\/\(\\w*\)\\s*\(\(.|\\s\)*\)$`, "im")) ||
      [];

    return [command.trim(), text.trim()];
  }
}

/** Map platform request to generic request for generic processing */
function createTelegramRequest<Context>(
  webhook: TelegramRawRequest,
  { username }: TelegramBot
): readonly TelegramRequest<Context>[] {
  function processMessageRequest({
    message: { chat, from: user, ...restMessage },
  }: TelegramRawRequest.Message):
    | [
        TelegramUser,
        TelegramRawRequest.Message.Message.Chat.Chat,
        TelegramRequest<Context>["input"]
      ]
    | undefined {
    if (isType<TelegramRawRequest.Message.Message.Text>(restMessage, "text")) {
      const { text } = restMessage;
      const [inputCommand, inputText] = extractInputCommand(username, text);

      return [
        user,
        chat,
        [
          {
            inputCommand,
            inputText,
            leftChatMembers: [],
            newChatMembers: [],
            targetPlatform: "telegram",
            inputImageURL: "",
            inputCoordinate: DEFAULT_COORDINATES,
          },
        ],
      ];
    }

    if (
      isType<TelegramRawRequest.Message.Message.NewChatMember>(
        restMessage,
        "new_chat_members"
      )
    ) {
      const { new_chat_members: newChatMembers } = restMessage;

      return [
        user,
        chat,
        [
          {
            newChatMembers,
            inputCommand: "",
            inputText: "",
            leftChatMembers: [],
            targetPlatform: "telegram",
            inputImageURL: "",
            inputCoordinate: DEFAULT_COORDINATES,
          },
        ],
      ];
    }

    if (
      isType<TelegramRawRequest.Message.Message.LeftChatMember>(
        restMessage,
        "left_chat_member"
      )
    ) {
      const { left_chat_member } = restMessage;

      return [
        user,
        chat,
        [
          {
            inputCommand: "",
            inputText: "",
            newChatMembers: [],
            leftChatMembers: [left_chat_member],
            targetPlatform: "telegram",
            inputImageURL: "",
            inputCoordinate: DEFAULT_COORDINATES,
          },
        ],
      ];
    }

    return undefined;
  }

  function processCallbackRequest({
    callback_query: { data, from: user },
  }: TelegramRawRequest.Callback):
    | [
        TelegramUser,
        TelegramRawRequest.Message.Message.Chat.Chat | undefined,
        TelegramRequest<Context>["input"]
      ]
    | undefined {
    return [
      user,
      undefined,
      [
        {
          targetPlatform: "telegram",
          inputCommand: "",
          inputText: data,
          inputImageURL: "",
          inputCoordinate: DEFAULT_COORDINATES,
          leftChatMembers: [],
          newChatMembers: [],
        },
      ],
    ];
  }

  function processRequest(
    request: TelegramRawRequest
  ):
    | [
        TelegramUser,
        TelegramRawRequest.Message.Message.Chat.Chat | undefined,
        TelegramRequest<Context>["input"]
      ]
    | undefined {
    let result: ReturnType<typeof processRequest> | undefined;

    if (isType<TelegramRawRequest.Message>(request, "message")) {
      result = processMessageRequest(request);
    }

    if (isType<TelegramRawRequest.Callback>(request, "callback_query")) {
      result = processCallbackRequest(request);
    }

    return result;
  }

  const processed = processRequest(webhook);

  if (!processed) {
    console.error(telegramError(`Invalid request: ${JSON.stringify(webhook)}`));
    return [];
  }

  const [telegramUser, chat, data] = processed;

  return [
    {
      targetPlatform: "telegram",
      telegramUser,
      input: data,
      targetID: !!chat ? `${chat.id}` : `${telegramUser.id}`,
      oldContext: {} as Context,
    },
  ];
}

/** Create a Telegram response from multiple generic responses */
function createTelegramResponse<Context>({
  targetID,
  output,
}: TelegramResponse<Context>): readonly TelegramRawResponse[] {
  function createTextResponse(
    targetID: string,
    { text }: BaseResponseOutput.MainContent.Text
  ): Omit<TelegramRawResponse.SendMessage, "reply_markup"> {
    return { text, action: "sendMessage", chat_id: targetID };
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    quickReplies: TelegramResponseOutput.QuickReply.InlineMarkupMatrix
  ): TelegramRawResponse.SendMessage.ReplyMarkup.InlineKeyboardMarkup {
    return {
      inline_keyboard: quickReplies.map((qrs) =>
        qrs.map((qr) => {
          const { text } = qr;

          switch (qr.type) {
            case "postback":
              return { text, callback_data: qr.payload };

            case "text":
              return { text, callback_data: text };
          }
        })
      ),
    };
  }

  /** Only certain quick reply types support reply markups. */
  function createReplyMarkups(
    quickReplyMatrix: TelegramResponseOutput.QuickReply.ReplyMarkupMatrix
  ): TelegramRawResponse.SendMessage.ReplyMarkup.ReplyKeyboardMarkup {
    return {
      keyboard: quickReplyMatrix.map((quickReplies) =>
        quickReplies.map((quickReply) => {
          const { text } = quickReply;

          switch (quickReply.type) {
            case "location":
              return {
                text,
                request_contact: undefined,
                request_location: true,
              };

            case "contact":
              return {
                text,
                request_contact: true,
                request_location: undefined,
              };

            case "text":
              return {
                text,
                request_contact: undefined,
                request_location: undefined,
              };
          }
        })
      ),
      resize_keyboard: true,
      one_time_keyboard: true,
      selective: false,
    };
  }

  /** Create a Telegram quick reply from a generic quick reply. */
  function createQuickReplies(
    quickReplyMatrix: TelegramResponseOutput.QuickReplyMatrix
  ): TelegramRawResponse.SendMessage.ReplyMarkup {
    const shouldBeReplyMarkup = quickReplyMatrix.every(
      (quickReplies: TelegramResponseOutput.QuickReplyMatrix[number]) =>
        quickReplies.every(
          ({
            type,
          }: TelegramResponseOutput.QuickReplyMatrix[number][number]) => {
            return type === "location";
          }
        )
    );

    if (shouldBeReplyMarkup) {
      return createReplyMarkups(
        quickReplyMatrix as TelegramResponseOutput.QuickReply.ReplyMarkupMatrix
      );
    }

    return createInlineMarkups(
      quickReplyMatrix as TelegramResponseOutput.QuickReply.InlineMarkupMatrix
    );
  }

  function createPlatformResponse(
    targetID: string,
    { quickReplies, content }: TelegramResponse<Context>["output"][number]
  ): TelegramRawResponse {
    const tlQuickReplies = quickReplies && createQuickReplies(quickReplies);

    switch (content.type) {
      case "text":
        return {
          ...createTextResponse(targetID, content),
          reply_markup: tlQuickReplies,
        };

      default:
        throw telegramError(`Unsupported content ${JSON.stringify(content)}`);
    }
  }

  return output.map((o) => createPlatformResponse(targetID, o));
}

/** Create a Telegram message processor */
export async function createTelegramMessageProcessor<Context>(
  leafSelector: LeafSelector<Context>,
  client: TelegramClient,
  ...transformers: readonly Transformer<TelegramMessageProcessor<Context>>[]
): Promise<TelegramMessageProcessor<Context>> {
  await client.setWebhook();
  const bot = await client.getCurrentBot();

  const baseProcessor = await createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "telegram",
      mapRequest: async (req) => createTelegramRequest(req, bot),
      mapResponse: async (res) => {
        return createTelegramResponse(res as TelegramResponse<Context>);
      },
    },
    ...transformers
  );

  return {
    ...baseProcessor,
    sendResponse: async (response) => {
      const { targetID } = response;

      if (!!(await client.isMember(targetID, `${bot.id}`))) {
        return baseProcessor.sendResponse(response);
      }

      return {};
    },
  };
}
