import { Omit } from "ts-essentials";
import {
  DEFAULT_COORDINATES,
  formatTelegramError,
  isType
} from "../common/utils";
import { Transformer } from "../type/common";
import { Leaf } from "../type/leaf";
import { Telegram as TL } from "../type/telegram";
import { VisualContent } from "../type/visual-content";
import { createMessenger } from "./generic-messenger";

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
  const [, command = "", text = inputText] =
    inputText.match(
      new RegExp(`^\\/\(\\w*\)\\s*@${username}\\s*\(\(.|\\s\)*\)$`, "im")
    ) || [];

  return [command.trim(), text.trim()];
}

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 */
function createTelegramRequest<C>(
  webhook: TL.PlatformRequest,
  { username }: TL.Bot
): readonly TL.GenericRequest<C>[] {
  function processMessageRequest({
    message: { chat, from: user, ...restMessage }
  }: TL.PlatformRequest.Message):
    | [
        TL.User,
        TL.PlatformRequest.SubContent.Message.Chat,
        TL.GenericRequest<C>["input"]
      ]
    | undefined {
    if (
      isType<TL.PlatformRequest.SubContent.Message.Text>(restMessage, "text")
    ) {
      const [inputCommand, inputText] = extractInputCommand(
        username,
        restMessage.text
      );

      return [
        user,
        chat,
        [
          {
            inputCommand,
            inputText,
            targetPlatform: "telegram",
            inputImageURL: "",
            inputCoordinate: DEFAULT_COORDINATES
          }
        ]
      ];
    }

    return undefined;
  }

  function processCallbackRequest({
    callback_query: { data, from: user }
  }: TL.PlatformRequest.Callback):
    | [
        TL.User,
        TL.PlatformRequest.SubContent.Message.Chat | undefined,
        TL.GenericRequest<C>["input"]
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
          inputCoordinate: DEFAULT_COORDINATES
        }
      ]
    ];
  }

  function processRequest(
    request: TL.PlatformRequest
  ): [
    TL.User,
    TL.PlatformRequest.SubContent.Message.Chat | undefined,
    TL.GenericRequest<C>["input"]
  ] {
    let result: ReturnType<typeof processRequest> | undefined;

    if (isType<TL.PlatformRequest.Message>(request, "message")) {
      result = processMessageRequest(request);
    }

    if (isType<TL.PlatformRequest.Callback>(request, "callback_query")) {
      result = processCallbackRequest(request);
    }

    if (!!result) return result;

    throw Error(
      formatTelegramError(`Invalid request ${JSON.stringify(request)}`)
    );
  }

  const [telegramUser, chat, data] = processRequest(webhook);

  return [
    {
      targetPlatform: "telegram",
      telegramUser,
      input: data,
      targetID: !!chat ? `${chat.id}` : `${telegramUser.id}`,
      oldContext: {} as C
    }
  ];
}

/**
 * Create a Telegram response from multiple generic responses.
 * @template C The context used by the current chatbot.
 */
function createTelegramResponse<C>({
  targetID,
  output
}: TL.GenericResponse<C>): readonly TL.PlatformResponse[] {
  function createTextResponse(
    targetID: string,
    { text }: VisualContent.MainContent.Text
  ): Omit<TL.PlatformResponse.SendMessage, "reply_markup"> {
    return { text, action: "sendMessage", chat_id: targetID };
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    quickReplies: TL.VisualContent.QuickReply.InlineMarkups
  ): TL.PlatformResponse.InlineKeyboardMarkup {
    return {
      inline_keyboard: quickReplies.map(qrs =>
        qrs.map(qr => {
          const { text } = qr;

          switch (qr.type) {
            case "postback":
              return { text, callback_data: qr.payload };

            case "text":
              return { text, callback_data: text };
          }
        })
      )
    };
  }

  /** Only certain quick reply types support reply markups. */
  function createReplyMarkups(
    quickReplies: TL.VisualContent.QuickReply.ReplyMarkups
  ): TL.PlatformResponse.ReplyKeyboardMarkup {
    return {
      keyboard: quickReplies.map(qrs =>
        qrs.map(qr => {
          const { text } = qr;

          switch (qr.type) {
            case "location":
              return {
                text,
                request_contact: undefined,
                request_location: true
              };

            case "contact":
              return {
                text,
                request_contact: true,
                request_location: undefined
              };

            case "text":
              return {
                text,
                request_contact: undefined,
                request_location: undefined
              };
          }
        })
      ),
      resize_keyboard: true,
      one_time_keyboard: true,
      selective: false
    };
  }

  /** Create a Telegram quick reply from a generic quick reply. */
  function createQuickReplies(
    quickReplies: TL.VisualContent.QuickReplies
  ): TL.PlatformResponse.ReplyMarkup {
    const shouldBeReplyMarkup = quickReplies.every(
      (qrs: TL.VisualContent.QuickReplies[number]) =>
        qrs.every(({ type }: TL.VisualContent.QuickReplies[number][number]) => {
          return type === "location";
        })
    );

    if (shouldBeReplyMarkup) {
      return createReplyMarkups(
        quickReplies as TL.VisualContent.QuickReply.ReplyMarkups
      );
    }

    return createInlineMarkups(
      quickReplies as TL.VisualContent.QuickReply.InlineMarkups
    );
  }

  function createPlatformResponse(
    targetID: string,
    { quickReplies, content }: TL.GenericResponse<C>["output"][number]
  ): TL.PlatformResponse {
    const tlQuickReplies = quickReplies && createQuickReplies(quickReplies);

    switch (content.type) {
      case "text":
        return {
          ...createTextResponse(targetID, content),
          reply_markup: tlQuickReplies
        };

      default:
        throw new Error(
          formatTelegramError(`Unsupported content ${JSON.stringify(content)}`)
        );
    }
  }

  return output.map(o => createPlatformResponse(targetID, o));
}

/**
 * Create a Telegram messenger.
 * @template C The context used by the current chatbot.
 */
export async function createTelegramMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: TL.Communicator,
  ...transformers: readonly Transformer<TL.Messenger<C>>[]
): Promise<TL.Messenger<C>> {
  await communicator.setWebhook();
  const bot = await communicator.getCurrentBot();

  return createMessenger(
    {
      leafSelector,
      communicator,
      targetPlatform: "telegram",
      mapRequest: async req => createTelegramRequest(req, bot),
      mapResponse: async res => {
        return createTelegramResponse(res as TL.GenericResponse<C>);
      }
    },
    ...transformers
  );
}
