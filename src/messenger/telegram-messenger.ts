import { Omit } from "ts-essentials";
import { isType, telegramError } from "../common/utils";
import { MessageProcessorMiddleware } from "../type";
import {
  TelegramBot,
  TelegramMessageProcessor,
  TelegramRawRequest as RawRequest,
  TelegramRawResponse,
  TelegramRequest,
  TelegramResponse,
  TelegramResponseOutput,
  TelegramUser,
  TelegramRequestInput,
} from "../type/telegram";
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
  webhook: RawRequest,
  currentBot: TelegramBot
): readonly TelegramRequest<Context>[] {
  const { username } = currentBot;

  function processMessageRequest({
    message: { chat, from: user, ...message },
  }: RawRequest.Message):
    | [TelegramUser, RawRequest.Chat, TelegramRequestInput[]]
    | undefined {
    if (isType<RawRequest.Message.Text>(message, "text")) {
      const { text } = message;
      const [inputCommand, inputText] = extractInputCommand(username, text);

      return [user, chat, [{ inputCommand, inputText }]];
    }

    if (isType<RawRequest.Message.Document>(message, "document")) {
      const { document } = message;
      return [user, chat, [{ inputDocument: document }]];
    }

    if (isType<RawRequest.Message.NewChatMember>(message, "new_chat_members")) {
      const { new_chat_members: newChatMembers } = message;
      return [user, chat, [{ newChatMembers }]];
    }

    if (
      isType<RawRequest.Message.LeftChatMember>(message, "left_chat_member")
    ) {
      const { left_chat_member } = message;
      return [user, chat, [{ leftChatMembers: [left_chat_member] }]];
    }

    if (isType<RawRequest.Message.Photo>(message, "photo")) {
      const { photo: inputPhotos } = message;
      return [user, chat, [{ inputPhotos }]];
    }

    return undefined;
  }

  function processCallbackRequest({
    callback_query: { data, from: user },
  }: RawRequest.Callback):
    | [TelegramUser, RawRequest.Chat | undefined, TelegramRequestInput[]]
    | undefined {
    return [user, undefined, [{ inputText: data }]];
  }

  function processRequest(
    request: RawRequest
  ):
    | [TelegramUser, RawRequest.Chat | undefined, TelegramRequestInput[]]
    | undefined {
    let result: ReturnType<typeof processRequest> | undefined;

    if (isType<RawRequest.Message>(request, "message")) {
      result = processMessageRequest(request);
    }

    if (isType<RawRequest.Callback>(request, "callback_query")) {
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
      currentBot,
      targetPlatform: "telegram",
      telegramUser,
      currentContext: {} as Context,
      input: data,
      targetID: !!chat ? `${chat.id}` : `${telegramUser.id}`,
      type: "message_trigger",
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
    { text }: TelegramResponseOutput.Content.Text
  ): Omit<TelegramRawResponse.SendMessage, "reply_markup"> {
    return { text, action: "sendMessage", chat_id: targetID };
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    quickReplies: TelegramResponseOutput.InlineMarkupMatrix
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
    quickReplyMatrix: TelegramResponseOutput.ReplyMarkupMatrix
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
    quickReply: TelegramResponseOutput.QuickReply
  ): TelegramRawResponse.SendMessage.ReplyMarkup {
    switch (quickReply.type) {
      case "inline_markup":
        return createInlineMarkups(quickReply.content);

      case "reply_markup":
        return createReplyMarkups(quickReply.content);
    }
  }

  function createPlatformResponse(
    targetID: string,
    {
      content,
      quickReplies,
      parseMode,
    }: TelegramResponse<Context>["output"][number]
  ): TelegramRawResponse {
    switch (content.type) {
      case "text":
        return {
          ...createTextResponse(targetID, content),
          parseMode,
          reply_markup: quickReplies && createQuickReplies(quickReplies),
        };

      default:
        throw telegramError(`Unsupported content ${JSON.stringify(content)}`);
    }
  }

  return output.map((o) => createPlatformResponse(targetID, o));
}

/** Create a Telegram message processor */
export async function createTelegramMessageProcessor<Context>(
  { leafSelector, client }: TelegramMessageProcessor.Configs<Context>,
  ...middlewares: readonly MessageProcessorMiddleware<
    TelegramMessageProcessor<Context>
  >[]
): Promise<TelegramMessageProcessor<Context>> {
  await client.setWebhook();
  const currentBot = await client.getCurrentBot();

  const baseProcessor = await createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "telegram",
      mapRequest: async (req) => {
        return createTelegramRequest(req, currentBot);
      },
      mapResponse: async (res) => {
        return createTelegramResponse(res as TelegramResponse<Context>);
      },
    },
    ...middlewares
  );

  return {
    ...baseProcessor,
    sendResponse: async (response) => {
      const { targetID } = response;

      if (!!(await client.isMember(targetID, `${currentBot.id}`))) {
        return baseProcessor.sendResponse(response);
      }

      return {};
    },
  };
}
