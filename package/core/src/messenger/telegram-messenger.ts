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
  TelegramGenericRequestInput,
  TelegramGenericResponse,
  TelegramMessageProcessor,
  TelegramMessageProcessorConfig,
  TelegramMessageProcessorMiddleware,
  TelegramRawRequest,
  TelegramRawResponse,
  TelegramUser,
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
export function createGenericTelegramRequest(
  rawRequest: TelegramRawRequest,
  currentBot: TelegramBot
): readonly TelegramGenericRequest[] {
  function processMessageRequest({
    message: { chat, from: user, ...message },
  }: _TelegramRawRequest.Message):
    | [TelegramUser, _TelegramRawRequest.Chat, TelegramGenericRequestInput[]]
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
  }: _TelegramRawRequest.Callback): [
    TelegramUser,
    _TelegramRawRequest.Chat | undefined,
    TelegramGenericRequestInput[]
  ] {
    return [user, undefined, [{ payload: data, type: "postback" }]];
  }

  function processPreCheckoutRequest({
    pre_checkout_query: {
      currency,
      from: user,
      id: checkoutID,
      invoice_payload: payload,
      total_amount: amount,
    },
  }: _TelegramRawRequest.PreCheckout): [
    TelegramUser,
    _TelegramRawRequest.Chat | undefined,
    TelegramGenericRequestInput[]
  ] {
    return [
      user,
      undefined,
      [{ amount, checkoutID, currency, payload, type: "pre_checkout" }],
    ];
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
  }: _TelegramRawRequest.SuccessfulPayment): [
    TelegramUser,
    _TelegramRawRequest.Chat | undefined,
    TelegramGenericRequestInput[]
  ] {
    return [
      user,
      chat,
      [
        {
          amount,
          currency,
          payload,
          providerPaymentChargeID,
          telegramPaymentChargeID,
          type: "successful_payment",
        },
      ],
    ];
  }

  function processRequest(
    request: TelegramRawRequest
  ):
    | [
        TelegramUser,
        _TelegramRawRequest.Chat | undefined,
        TelegramGenericRequestInput[]
      ]
    | undefined {
    let result: ReturnType<typeof processRequest> | undefined;

    if (isType<_TelegramRawRequest.Callback>(request, "callback_query")) {
      result = processCallbackRequest(request);
    } else if (
      isType<_TelegramRawRequest.PreCheckout>(request, "pre_checkout_query")
    ) {
      result = processPreCheckoutRequest(request);
    } else if ("message" in request) {
      const { message, ...restRequest } = request;

      if (
        isType<_TelegramRawRequest.SuccessfulPayment["message"]>(
          message,
          "successful_payment"
        )
      ) {
        result = processSuccessfulPaymentRequest({ message, ...restRequest });
      } else {
        result = processMessageRequest({ message, ...restRequest });
      }
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
    currentContext: {} as ChatbotContext,
    targetID: !!chat ? `${chat.id}` : `${telegramUser.id}`,
    type: "message_trigger",
  }));
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
    if (!!caption) {
      formData.append("caption", caption);
    }

    if (!!reply_markup) {
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
