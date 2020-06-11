import FormData from "form-data";
import { telegramError } from "../common/utils";
import { MessageProcessorMiddleware } from "../type";
import {
  TelegramBot,
  TelegramMessageProcessor,
  TelegramMessageProcessorConfig,
  TelegramRawRequest as RawRequest,
  TelegramRawResponse,
  TelegramRequest,
  TelegramRequestInput,
  TelegramResponse,
  TelegramResponseOutput,
  TelegramUser,
} from "../type/telegram";
import { createMessageProcessor } from "./generic-messenger";

/**
 * Extract an input command from an input text. For example:
 * /start @abcbot 123
 * should give [start, 123], i.e. the command and the instruction. If the
 * command does not exist, fallback to the base input text for instruction.
 */
export function extractcommand(
  username: string,
  textWithCommand: string
): [string, string] {
  const usernamePing = `@${username}`;

  if (textWithCommand.includes(usernamePing)) {
    /** In this case, the bot is in a group, so it needs to be pinged */
    const [, command = "", text = textWithCommand] =
      textWithCommand.match(
        new RegExp(`^\\/\(\\w*\)\\s*${usernamePing}\\s*\(\(.|\\s\)*\)$`, "im")
      ) || [];

    return [command.trim(), text.trim()];
  } else {
    const [, command = "", text = textWithCommand] =
      textWithCommand.match(
        new RegExp(`^\\/\(\\w*\)\\s*\(\(.|\\s\)*\)$`, "im")
      ) || [];

    return [command.trim(), text.trim()];
  }
}

/** Map platform request to generic request for generic processing */
export function createGenericTelegramRequest<Context>(
  webhook: RawRequest,
  currentBot: TelegramBot
): readonly TelegramRequest<Context>[] {
  const { username } = currentBot;

  function processMessageRequest({
    message: { chat, from: user, ...message },
  }: RawRequest.Message):
    | [TelegramUser, RawRequest.Chat, TelegramRequestInput<Context>[]]
    | undefined {
    if ("text" in message) {
      const { text: textWithCommand } = message;
      const [command, text] = extractcommand(username, textWithCommand);

      if (!!command) {
        return [
          user,
          chat,
          [{ command, text: !!text ? text : undefined, type: "command" }],
        ];
      } else {
        return [user, chat, [{ text, type: "text" }]];
      }
    }

    if ("document" in message) {
      const { document } = message;
      return [user, chat, [{ document: document, type: "document" }]];
    }

    if ("new_chat_members" in message) {
      const { new_chat_members: newChatMembers } = message;
      return [user, chat, [{ newChatMembers, type: "joined_chat" }]];
    }

    if ("left_chat_member" in message) {
      const { left_chat_member } = message;

      return [
        user,
        chat,
        [{ leftChatMembers: [left_chat_member], type: "left_chat" }],
      ];
    }

    if ("photo" in message) {
      const { photo: images } = message;
      return [user, chat, [{ images, type: "image" }]];
    }

    return undefined;
  }

  function processCallbackRequest({
    callback_query: { data, from: user },
  }: RawRequest.Callback): [
    TelegramUser,
    RawRequest.Chat | undefined,
    TelegramRequestInput<Context>[]
  ] {
    return [user, undefined, [{ payload: data, type: "postback" }]];
  }

  function processRequest(
    request: RawRequest
  ):
    | [
        TelegramUser,
        RawRequest.Chat | undefined,
        TelegramRequestInput<Context>[]
      ]
    | undefined {
    let result: ReturnType<typeof processRequest> | undefined;

    if ("callback_query" in request) {
      result = processCallbackRequest(request);
    }

    if ("message" in request) {
      result = processMessageRequest(request);
    }

    return result;
  }

  const processed = processRequest(webhook);

  if (!processed) {
    console.error(telegramError(`Invalid request: ${JSON.stringify(webhook)}`));
    return [];
  }

  const [telegramUser, chat, inputs] = processed;

  return inputs.map((input) => ({
    currentBot,
    input,
    targetPlatform: "telegram",
    telegramUser,
    currentContext: {} as Context,
    targetID: !!chat ? `${chat.id}` : `${telegramUser.id}`,
    type: "message_trigger",
  }));
}

/** Create a Telegram response from multiple generic responses */
function createRawTelegramResponse<Context>({
  targetID,
  output,
}: TelegramResponse<Context>): readonly TelegramRawResponse[] {
  function createDocumentResponse(
    chat_id: string,
    reply_markup: TelegramRawResponse.ReplyMarkup | undefined,
    {
      fileData: document,
      fileName: filename,
      text: caption,
    }: TelegramResponseOutput.Content.Document
  ): TelegramRawResponse.SendDocument {
    const formData = new FormData();
    if (!!caption) formData.append("caption", caption);
    if (!!reply_markup) formData.append("reply_markup", reply_markup);
    formData.append("chat_id", chat_id);
    formData.append("document", document, { filename });
    return formData;
  }

  function createImageResponse({
    image: photo,
    text: caption,
  }: TelegramResponseOutput.Content.Image): TelegramRawResponse.SendPhoto {
    return { caption, photo };
  }

  function createTextResponse({
    text,
  }: TelegramResponseOutput.Content.Text): TelegramRawResponse.SendMessage {
    return { text };
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    matrix: TelegramResponseOutput.InlineMarkupMatrix
  ): TelegramRawResponse.ReplyMarkup.InlineKeyboardMarkup {
    return {
      inline_keyboard: matrix.map((quickReplies) =>
        quickReplies.map((quickReply) => {
          const { text } = quickReply;

          switch (quickReply.type) {
            case "postback":
              return { text, callback_data: quickReply.payload };

            case "text":
              return { text, callback_data: text };

            case "url":
              return { text, url: quickReply.url };
          }
        })
      ),
    };
  }

  /** Only certain quick reply types support reply markups. */
  function createReplyMarkups(
    matric: TelegramResponseOutput.ReplyMarkupMatrix
  ): TelegramRawResponse.ReplyMarkup.ReplyKeyboardMarkup {
    return {
      keyboard: matric.map((quickReplies) =>
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
  ): TelegramRawResponse.ReplyMarkup {
    switch (quickReply.type) {
      case "inline_markup":
        return createInlineMarkups(quickReply.content);

      case "reply_markup":
        return createReplyMarkups(quickReply.content);

      case "remove_reply_keyboard":
        return { remove_keyboard: true };
    }
  }

  function createRawResponse(
    targetID: string,
    {
      content,
      quickReplies,
      parseMode,
    }: TelegramResponse<Context>["output"][number]
  ): TelegramRawResponse {
    const reply_markup = quickReplies && createQuickReplies(quickReplies);

    if (content.type === "document") {
      const documentForm = createDocumentResponse(
        targetID,
        reply_markup,
        content
      );

      return {
        parseMode,
        action: "sendDocument",
        body: documentForm,
        headers: documentForm.getHeaders(),
      };
    } else if (content.type === "image") {
      return {
        parseMode,
        action: "sendPhoto",
        body: {
          chat_id: targetID,
          reply_markup,
          ...createImageResponse(content),
        },
      };
    } else {
      return {
        parseMode,
        action: "sendMessage",
        body: {
          chat_id: targetID,
          reply_markup,
          ...createTextResponse(content),
        },
      };
    }
  }

  return output.map((o) => createRawResponse(targetID, o));
}

/** Create a Telegram message processor */
export async function createTelegramMessageProcessor<Context>(
  { leafSelector, client }: TelegramMessageProcessorConfig<Context>,
  ...middlewares: readonly MessageProcessorMiddleware<Context>[]
): Promise<TelegramMessageProcessor<Context>> {
  await client.setWebhook();
  const currentBot = await client.getCurrentBot();

  const baseProcessor = await createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "telegram",
      mapRequest: async (req) => {
        return createGenericTelegramRequest(req as RawRequest, currentBot);
      },
      mapResponse: async (res) => {
        return createRawTelegramResponse(res as TelegramResponse<Context>);
      },
    },
    ...middlewares
  );

  return baseProcessor;
}
