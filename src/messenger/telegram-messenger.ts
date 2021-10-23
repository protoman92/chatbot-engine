import FormData from "form-data";
import { chunkString, firstSubString, telegramError } from "../common/utils";
import {
  MessageProcessorMiddleware,
  TelegramBot,
  TelegramGenericRequest,
  TelegramGenericResponse,
  TelegramMessageProcessor,
  TelegramMessageProcessorConfig,
  TelegramMessageProcessorMiddleware,
  TelegramRawRequest,
  TelegramRawResponse,
  TelegramRequestInput,
  TelegramUser,
  _TelegramGenericResponseOutput,
  _TelegramRawRequest as RawRequest,
  _TelegramRawRequest,
  _TelegramRawResponse,
} from "../type";
import { createMessageProcessor } from "./generic-messenger";

const CAPTION_TEXT_CHARACTER_LIMIT = 1024;
const MESSAGE_TEXT_CHARACTER_LIMIT = 4096;

/**
 * Extract an input command from an input text. For example:
 * /start @abcbot 123
 * should give [start, 123], i.e. the command and the instruction. If the
 * command does not exist, fallback to the base input text for instruction.
 */
export function extractCommand(
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
  rawRequest: TelegramRawRequest,
  currentBot: TelegramBot
): readonly TelegramGenericRequest<Context>[] {
  function processMessageRequest({
    message: { chat, from: user, ...message },
  }: _TelegramRawRequest.Message):
    | [TelegramUser, RawRequest.Chat, TelegramRequestInput<Context>[]]
    | undefined {
    if ("text" in message) {
      const { text: textWithCommand } = message;

      const [command, text] = extractCommand(
        currentBot.username,
        textWithCommand
      );

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
      return [user, chat, [{ document: message.document, type: "document" }]];
    }

    if ("location" in message) {
      return [user, chat, [{ coordinate: message.location, type: "location" }]];
    }

    if ("new_chat_members" in message) {
      return [
        user,
        chat,
        [{ newChatMembers: message.new_chat_members, type: "joined_chat" }],
      ];
    }

    if ("left_chat_member" in message) {
      return [
        user,
        chat,
        [{ leftChatMembers: [message.left_chat_member], type: "left_chat" }],
      ];
    }

    if ("photo" in message) {
      return [user, chat, [{ images: message.photo, type: "image" }]];
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
    request: TelegramRawRequest
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

  const processed = processRequest(rawRequest);

  if (processed == null) {
    console.error(
      telegramError(`Invalid request: ${JSON.stringify(rawRequest)}`)
    );
    return [];
  }

  const [telegramUser, chat, inputs] = processed;

  return inputs.map((input) => ({
    currentBot,
    input,
    rawRequest,
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
}: TelegramGenericResponse<Context>): readonly TelegramRawResponse[] {
  function createDocumentResponse(
    chat_id: string,
    reply_markup: _TelegramRawResponse.ReplyMarkup | undefined,
    {
      fileData: document,
      fileName: filename,
      text: caption,
    }: _TelegramGenericResponseOutput.Content.Document
  ): _TelegramRawResponse.SendDocument {
    const formData = new FormData();
    if (!!caption) {
      formData.append("caption", caption);
    }

    if (!!reply_markup) {
      formData.append("reply_markup", reply_markup);
    }

    formData.append("chat_id", chat_id);
    formData.append("document", document, { filename });
    return formData;
  }

  function createImageResponses({
    image: photo,
    text: fullCaption = "",
  }: _TelegramGenericResponseOutput.Content.Image): readonly [
    _TelegramRawResponse.SendPhoto,
    ...(readonly _TelegramRawResponse.SendMessage[])
  ] {
    const { firstSubstring: caption, restSubstring } = firstSubString(
      fullCaption,
      CAPTION_TEXT_CHARACTER_LIMIT
    );

    return [
      { caption, photo },
      ...chunkString(restSubstring, MESSAGE_TEXT_CHARACTER_LIMIT).map(
        (text) => {
          return { text };
        }
      ),
    ];
  }

  function createTextResponses({
    text: fullText,
  }: _TelegramGenericResponseOutput.Content.Text): _TelegramRawResponse.SendMessage[] {
    return chunkString(fullText, MESSAGE_TEXT_CHARACTER_LIMIT).map((text) => {
      return { text };
    });
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    matrix: _TelegramGenericResponseOutput.InlineMarkupMatrix
  ): _TelegramRawResponse.ReplyMarkup.InlineKeyboardMarkup {
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
    matric: _TelegramGenericResponseOutput.ReplyMarkupMatrix
  ): _TelegramRawResponse.ReplyMarkup.ReplyKeyboardMarkup {
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
    quickReply: _TelegramGenericResponseOutput.QuickReply
  ): _TelegramRawResponse.ReplyMarkup {
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
    }: TelegramGenericResponse<Context>["output"][number]
  ): TelegramRawResponse[] {
    const reply_markup = quickReplies && createQuickReplies(quickReplies);

    if (content.type === "document") {
      const documentForm = createDocumentResponse(
        targetID,
        reply_markup,
        content
      );

      return [
        {
          parseMode,
          action: "sendDocument",
          body: documentForm,
          headers: documentForm.getHeaders(),
        },
      ];
    } else if (content.type === "image") {
      const [imageBody, ...textBodies] = createImageResponses(content);

      const mergedResponses = [
        {
          parseMode,
          action: "sendPhoto" as const,
          body: {
            ...imageBody,
            chat_id: targetID,
            reply_markup: textBodies.length > 0 ? undefined : reply_markup,
          },
        },
        ...textBodies.map((textBody, idx, { length }) => ({
          parseMode,
          action: "sendMessage" as const,
          body: {
            ...textBody,
            chat_id: targetID,
            reply_markup: idx === length - 1 ? reply_markup : undefined,
          },
        })),
      ];

      return mergedResponses;
    } else {
      return createTextResponses(content).map((textBody, idx, { length }) => ({
        parseMode,
        action: "sendMessage",
        body: {
          ...textBody,
          chat_id: targetID,
          reply_markup: idx === length - 1 ? reply_markup : undefined,
        },
      }));
    }
  }

  return output.reduce((acc, o) => {
    acc.push(...createRawResponse(targetID, o));
    return acc;
  }, [] as TelegramRawResponse[]);
}

/** Create a Telegram message processor */
export async function createTelegramMessageProcessor<Context>(
  { leafSelector, client }: TelegramMessageProcessorConfig<Context>,
  ...middlewares: readonly (
    | MessageProcessorMiddleware<Context>
    | TelegramMessageProcessorMiddleware<Context>
  )[]
): Promise<TelegramMessageProcessor<Context>> {
  const currentBot = await client.getCurrentBot();

  const baseProcessor = await createMessageProcessor<Context>(
    {
      leafSelector,
      client,
      targetPlatform: "telegram",
      mapRequest: async (rawRequest) => {
        return createGenericTelegramRequest(
          rawRequest as TelegramRawRequest,
          currentBot
        );
      },
      mapResponse: async (genericResponse) => {
        return createRawTelegramResponse(
          genericResponse as TelegramGenericResponse<Context>
        );
      },
    },
    ...(middlewares as MessageProcessorMiddleware<Context>[])
  );

  return baseProcessor as TelegramMessageProcessor<Context>;
}
