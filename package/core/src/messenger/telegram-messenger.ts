import { isType } from "@haipham/javascript-helper-preconditions";
import FormData from "form-data";
import { ChatbotContext } from "..";
import {
  chunkString,
  firstSubString,
  getErrorMessage,
  telegramError,
} from "../common/utils";
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
  TelegramUser,
  _TelegramGenericRequest,
  _TelegramGenericResponseOutput,
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
  textWithCommand: string
): Readonly<{
  botUsername: string | undefined;
  command: string | undefined;
  text: string;
}> {
  const { command, text = textWithCommand, username: botUsername } =
    textWithCommand.match(
      /^\/(?<command>\w*)\s*(\@(?<username>\w+))*\s*(?<text>(.|\s)*)$/
    )?.groups ?? {};

  return {
    botUsername: botUsername?.trim(),
    command: command?.trim(),
    text: text.trim(),
  };
}

function processMessageRequest({
  currentBot,
  message: {
    message: { from: user, ...message },
  },
}: Readonly<{
  currentBot: TelegramBot;
  message: _TelegramRawRequest.Message;
}>):
  | Readonly<{
      chat: _TelegramRawRequest.Chat;
      inputs: readonly _TelegramGenericRequest.MessageTrigger["input"][];
      user: TelegramUser;
    }>
  | undefined {
  if ("text" in message) {
    const { text: textWithCommand } = message;
    const { botUsername, command, text } = extractCommand(textWithCommand);

    if (command) {
      return {
        user,
        chat: message.chat,
        inputs: [
          {
            command,
            /**
             * Two cases where this can be true:
             * - The user is chatting with the bot in a private chat, or;
             * - The user pings the bot by username.
             */
            isMeantForThisBot:
              !botUsername || botUsername === currentBot.username,
            pingedBotUsername: botUsername,
            text: text || undefined,
            type: "command",
          },
        ],
      };
    } else {
      return { user, chat: message.chat, inputs: [{ text, type: "text" }] };
    }
  }

  if ("document" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [{ document: message.document, type: "document" }],
    };
  }

  if ("group_chat_created" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [
        {
          areAllMembersAdministrators:
            message.chat.all_members_are_administrators,
          groupName: message.chat.title,
          type: "group_chat_created",
        },
      ],
    };
  }

  if ("location" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [{ coordinate: message.location, type: "location" }],
    };
  }

  if ("new_chat_members" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [
        { newChatMembers: message.new_chat_members, type: "joined_chat" },
      ],
    };
  }

  if ("left_chat_member" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [
        { leftChatMembers: [message.left_chat_member], type: "left_chat" },
      ],
    };
  }

  if ("photo" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [{ images: message.photo, type: "image" }],
    };
  }

  if ("video" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [{ type: "video", video: message.video }],
    };
  }

  return undefined;
}

function processCallbackRequest({
  callback_query: { data, from: user, message },
}: _TelegramRawRequest.Callback): Readonly<{
  chat: _TelegramRawRequest.Chat;
  inputs: readonly _TelegramGenericRequest.MessageTrigger["input"][];
  user: TelegramUser;
}> {
  return {
    user,
    chat: message.chat,
    inputs: [{ payload: data, type: "postback" }],
  };
}

function processPreCheckoutRequest({
  pre_checkout_query: {
    currency,
    from: user,
    id: checkoutID,
    invoice_payload: payload,
    total_amount: amount,
  },
}: _TelegramRawRequest.PreCheckout): Readonly<{
  chat: _TelegramRawRequest.Chat | undefined;
  inputs: readonly _TelegramGenericRequest.MessageTrigger["input"][];
  user: TelegramUser;
}> {
  return {
    user,
    chat: undefined,
    inputs: [{ amount, checkoutID, currency, payload, type: "pre_checkout" }],
  };
}

function processSuccessfulPaymentRequest({
  message: {
    chat,
    from: user,
    successful_payment: {
      currency,
      invoice_payload: payload,
      provider_payment_charge_id: providerPaymentChargeID,
      telegram_payment_charge_id: telegramPaymentChargeID,
      total_amount: amount,
    },
  },
}: _TelegramRawRequest.SuccessfulPayment): Readonly<{
  chat: _TelegramRawRequest.Chat | undefined;
  inputs: readonly _TelegramGenericRequest.MessageTrigger["input"][];
  user: TelegramUser;
}> {
  return {
    user,
    chat,
    inputs: [
      {
        amount,
        currency,
        payload,
        providerPaymentChargeID,
        telegramPaymentChargeID,
        type: "successful_payment",
      },
    ],
  };
}

/** Map platform request to generic request for generic processing */
export function createGenericTelegramRequest(
  rawRequest: TelegramRawRequest,
  currentBot: TelegramBot
): readonly TelegramGenericRequest[] {
  let requestData:
    | Readonly<{
        chat: _TelegramRawRequest.Chat | undefined;
        inputs: readonly _TelegramGenericRequest.MessageTrigger["input"][];
        user: TelegramUser;
      }>
    | undefined;

  if (isType<_TelegramRawRequest.Callback>(rawRequest, "callback_query")) {
    requestData = processCallbackRequest(rawRequest);
  } else if (
    isType<_TelegramRawRequest.PreCheckout>(rawRequest, "pre_checkout_query")
  ) {
    requestData = processPreCheckoutRequest(rawRequest);
  } else if ("message" in rawRequest) {
    const { message, ...restRequest } = rawRequest;

    if (
      isType<_TelegramRawRequest.SuccessfulPayment["message"]>(
        message,
        "successful_payment"
      )
    ) {
      requestData = processSuccessfulPaymentRequest({
        message,
        ...restRequest,
      });
    } else {
      requestData = processMessageRequest({
        currentBot,
        message: { message, ...restRequest },
      });
    }
  }

  if (requestData == null) {
    console.error(
      telegramError(`Invalid request: ${JSON.stringify(rawRequest)}`)
    );

    return [];
  }

  const { chat, inputs, user: telegramUser } = requestData;

  return inputs.map(
    (input): TelegramGenericRequest => {
      return {
        currentBot,
        input,
        rawRequest,
        telegramUser,
        chatType: chat?.type,
        targetPlatform: "telegram",
        currentContext: {} as ChatbotContext,
        targetID: chat?.id.toString() || telegramUser.id.toString(),
        triggerType: "message",
      };
    }
  );
}

/** Create a Telegram response from multiple generic responses */
function createRawTelegramResponse({
  targetID,
  output,
}: TelegramGenericResponse): readonly TelegramRawResponse[] {
  function createDocumentResponse(
    chat_id: string,
    reply_markup: _TelegramRawResponse.ReplyMarkup | undefined,
    {
      fileData: document,
      fileName,
      text: caption,
    }: _TelegramGenericResponseOutput.Content.Document
  ): _TelegramRawResponse.SendDocument {
    const formData = new FormData();
    if (caption) {
      formData.append("caption", caption);
    }

    if (reply_markup != null) {
      formData.append("reply_markup", reply_markup);
    }

    formData.append("chat_id", chat_id);
    /** Force ! to avoid TS complaining about undefined vs optional */
    formData.append("document", document, { filename: fileName! });
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

  function createInvoiceResponse({
    type,
    ...args
  }: _TelegramGenericResponseOutput.Content.Invoice): _TelegramRawResponse.SendInvoice {
    return { ...args };
  }

  function createPreCheckoutConfirmationResponse({
    checkoutID: pre_checkout_query_id,
    error,
    isOK,
  }: _TelegramGenericResponseOutput.Content.PreCheckoutConfirmation): _TelegramRawResponse.AnswerPreCheckoutQuery {
    return {
      ok: isOK || false,
      pre_checkout_query_id,
      error_message: error == null ? undefined : getErrorMessage(error),
    };
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
      inline_keyboard: matrix.map((quickReplies) => {
        return quickReplies.map((quickReply) => {
          const { text } = quickReply;

          switch (quickReply.type) {
            case "postback":
              return { text, callback_data: quickReply.payload };

            case "text":
              return { text, callback_data: text };

            case "url":
              return { text, url: quickReply.url };
          }
        });
      }),
    };
  }

  /** Only certain quick reply types support reply markups. */
  function createReplyMarkups(
    matric: _TelegramGenericResponseOutput.ReplyMarkupMatrix
  ): _TelegramRawResponse.ReplyMarkup.ReplyKeyboardMarkup {
    return {
      keyboard: matric.map((quickReplies) => {
        return quickReplies.map((quickReply) => {
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
        });
      }),
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
    }: TelegramGenericResponse["output"][number]
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
    } else if (content.type === "invoice") {
      const invoiceResponse = createInvoiceResponse(content);

      return [
        {
          parseMode,
          action: "sendInvoice",
          body: { ...invoiceResponse, chat_id: targetID },
        },
      ];
    } else if (content.type === "pre_checkout_confirmation") {
      const answerResponse = createPreCheckoutConfirmationResponse(content);

      return [
        {
          parseMode,
          action: "answerPreCheckoutQuery",
          body: { ...answerResponse, chat_id: targetID },
        },
      ];
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
export async function createTelegramMessageProcessor(
  { leafSelector, client }: TelegramMessageProcessorConfig,
  ...middlewares: readonly (
    | MessageProcessorMiddleware
    | TelegramMessageProcessorMiddleware
  )[]
): Promise<TelegramMessageProcessor> {
  const currentBot = await client.getCurrentBot();

  const baseProcessor = await createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "telegram",
      mapRequest: async ({ rawRequest }) => {
        return createGenericTelegramRequest(
          rawRequest as TelegramRawRequest,
          currentBot
        );
      },
      mapResponse: async (genericResponse) => {
        return createRawTelegramResponse(
          genericResponse as TelegramGenericResponse
        );
      },
    },
    ...(middlewares as MessageProcessorMiddleware[])
  );

  return baseProcessor as TelegramMessageProcessor;
}
