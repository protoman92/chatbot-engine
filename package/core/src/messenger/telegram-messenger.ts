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
  TelegramGenericResponseOutput,
  TelegramMessageProcessor,
  TelegramMessageProcessorConfig,
  TelegramMessageProcessorMiddleware,
  TelegramRawRequest,
  TelegramRawResponse,
  TelegramUser,
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
export function extractCommand(textWithCommand: string): Readonly<{
  botUsername: string | undefined;
  command: string | undefined;
  text: string;
}> {
  const {
    command,
    text = textWithCommand,
    username: botUsername,
  } = textWithCommand.match(
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
  message: TelegramRawRequest.Message;
}>):
  | Readonly<{
      chat: TelegramRawRequest.Chat;
      inputs: readonly TelegramGenericRequest.MessageTrigger["input"][];
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
            type: "telegram.command",
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
      inputs: [{ document: message.document, type: "telegram.document" }],
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
          type: "telegram.group_chat_created",
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
        {
          newChatMembers: message.new_chat_members,
          type: "telegram.joined_chat",
        },
      ],
    };
  }

  if ("left_chat_member" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [
        {
          leftChatMembers: [message.left_chat_member],
          type: "telegram.left_chat",
        },
      ],
    };
  }

  if ("photo" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [{ images: message.photo, type: "telegram.image" }],
    };
  }

  if ("video" in message) {
    return {
      user,
      chat: message.chat,
      inputs: [{ type: "telegram.video", video: message.video }],
    };
  }

  return undefined;
}

function processCallbackRequest({
  callback_query: { data, from: user, message },
}: TelegramRawRequest.Callback): Readonly<{
  chat: TelegramRawRequest.Chat;
  inputs: readonly TelegramGenericRequest.MessageTrigger["input"][];
  user: TelegramUser;
}> {
  return {
    user,
    chat: message.chat,
    inputs: [{ payload: data, type: "postback" }],
  };
}

function processMyChatMemberRequest({
  my_chat_member: { chat, from: user, new_chat_member, old_chat_member },
}: TelegramRawRequest.MyChatMember): Readonly<{
  chat: TelegramRawRequest.Chat | undefined;
  inputs: readonly TelegramGenericRequest.MessageTrigger["input"][];
  user: TelegramUser;
}> {
  return {
    chat,
    user,
    inputs: [
      {
        newMember: new_chat_member,
        oldMember: old_chat_member,
        type: "telegram.chat_member_updated",
      },
    ],
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
}: TelegramRawRequest.PreCheckout): Readonly<{
  chat: TelegramRawRequest.Chat | undefined;
  inputs: readonly TelegramGenericRequest.MessageTrigger["input"][];
  user: TelegramUser;
}> {
  return {
    user,
    chat: undefined,
    inputs: [
      { amount, checkoutID, currency, payload, type: "telegram.pre_checkout" },
    ],
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
}: TelegramRawRequest.SuccessfulPayment): Readonly<{
  chat: TelegramRawRequest.Chat | undefined;
  inputs: readonly TelegramGenericRequest.MessageTrigger["input"][];
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
        type: "telegram.successful_payment",
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
        chat: TelegramRawRequest.Chat | undefined;
        inputs: readonly TelegramGenericRequest.MessageTrigger["input"][];
        user: TelegramUser;
      }>
    | undefined;

  if (isType<TelegramRawRequest.Callback>(rawRequest, "callback_query")) {
    requestData = processCallbackRequest(rawRequest);
  } else if (
    isType<TelegramRawRequest.MyChatMember>(rawRequest, "my_chat_member")
  ) {
    requestData = processMyChatMemberRequest(rawRequest);
  } else if (
    isType<TelegramRawRequest.PreCheckout>(rawRequest, "pre_checkout_query")
  ) {
    requestData = processPreCheckoutRequest(rawRequest);
  } else if ("message" in rawRequest) {
    const { message, ...restRequest } = rawRequest;

    if (
      isType<TelegramRawRequest.SuccessfulPayment["message"]>(
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

  return inputs.map((input): TelegramGenericRequest => {
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
  });
}

/** Create a Telegram response from multiple generic responses */
function createRawTelegramResponse({
  targetID,
  output,
}: TelegramGenericResponse): readonly TelegramRawResponse[] {
  function createDocumentResponse(
    chat_id: string,
    reply_markup: TelegramRawResponse.ReplyMarkup | undefined,
    {
      fileData: document,
      fileName,
      text: caption,
    }: TelegramGenericResponseOutput.Content.Document
  ): TelegramRawResponse.SendDocument {
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
  }: TelegramGenericResponseOutput.Content.Image): readonly [
    TelegramRawResponse.SendPhoto,
    ...(readonly TelegramRawResponse.SendMessage[])
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
  }: TelegramGenericResponseOutput.Content.Invoice): TelegramRawResponse.SendInvoice {
    return { ...args };
  }

  function createPreCheckoutConfirmationResponse({
    checkoutID: pre_checkout_query_id,
    error,
    isOK,
  }: TelegramGenericResponseOutput.Content.PreCheckoutConfirmation): TelegramRawResponse.AnswerPreCheckoutQuery {
    return {
      ok: isOK || false,
      pre_checkout_query_id,
      error_message: error == null ? undefined : getErrorMessage(error),
    };
  }

  function createTextResponses({
    text: fullText,
  }: TelegramGenericResponseOutput.Content.Text): TelegramRawResponse.SendMessage[] {
    return chunkString(fullText, MESSAGE_TEXT_CHARACTER_LIMIT).map((text) => {
      return { text };
    });
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    matrix: TelegramGenericResponseOutput.InlineMarkupMatrix
  ): TelegramRawResponse.ReplyMarkup.InlineKeyboardMarkup {
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
    matric: TelegramGenericResponseOutput.ReplyMarkupMatrix
  ): TelegramRawResponse.ReplyMarkup.ReplyKeyboardMarkup {
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
    quickReply: TelegramGenericResponseOutput.QuickReply
  ): TelegramRawResponse.ReplyMarkup {
    switch (quickReply.type) {
      case "telegram.inline_markup":
        return createInlineMarkups(quickReply.content);

      case "telegram.reply_markup":
        return createReplyMarkups(quickReply.content);

      case "telegram.remove_reply_keyboard":
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

    if (content.type === "telegram.document") {
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
    } else if (content.type === "telegram.image") {
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
    } else if (content.type === "telegram.invoice") {
      const invoiceResponse = createInvoiceResponse(content);

      return [
        {
          parseMode,
          action: "sendInvoice",
          body: { ...invoiceResponse, chat_id: targetID },
        },
      ];
    } else if (content.type === "telegram.pre_checkout_confirmation") {
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
