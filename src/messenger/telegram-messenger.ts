import { Omit } from "ts-essentials";
import { DEFAULT_COORDINATES, isType, telegramError } from "../common/utils";
import { Transformer } from "../type/common";
import { Leaf } from "../type/leaf";
import { Telegram } from "../type/telegram";
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
  webhook: Telegram.PlatformRequest,
  { username }: Telegram.Bot
): readonly Telegram.GenericRequest<C>[] {
  function processMessageRequest({
    message: { chat, from: user, ...restMessage }
  }: Telegram.PlatformRequest.Message):
    | [
        Telegram.User,
        Telegram.PlatformRequest.Message.Message.Chat.Chat,
        Telegram.GenericRequest<C>["input"]
      ]
    | undefined {
    if (
      isType<Telegram.PlatformRequest.Message.Message.Text>(restMessage, "text")
    ) {
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
            inputCoordinate: DEFAULT_COORDINATES
          }
        ]
      ];
    }

    if (
      isType<Telegram.PlatformRequest.Message.Message.NewChatMember>(
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
            inputCoordinate: DEFAULT_COORDINATES
          }
        ]
      ];
    }

    if (
      isType<Telegram.PlatformRequest.Message.Message.LeftChatMember>(
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
            inputCoordinate: DEFAULT_COORDINATES
          }
        ]
      ];
    }

    return undefined;
  }

  function processCallbackRequest({
    callback_query: { data, from: user }
  }: Telegram.PlatformRequest.Callback):
    | [
        Telegram.User,
        Telegram.PlatformRequest.Message.Message.Chat.Chat | undefined,
        Telegram.GenericRequest<C>["input"]
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
          newChatMembers: []
        }
      ]
    ];
  }

  function processRequest(
    request: Telegram.PlatformRequest
  ):
    | [
        Telegram.User,
        Telegram.PlatformRequest.Message.Message.Chat.Chat | undefined,
        Telegram.GenericRequest<C>["input"]
      ]
    | undefined {
    let result: ReturnType<typeof processRequest> | undefined;

    if (isType<Telegram.PlatformRequest.Message>(request, "message")) {
      result = processMessageRequest(request);
    }

    if (isType<Telegram.PlatformRequest.Callback>(request, "callback_query")) {
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
}: Telegram.GenericResponse<C>): readonly Telegram.PlatformResponse[] {
  function createTextResponse(
    targetID: string,
    { text }: VisualContent.MainContent.Text
  ): Omit<Telegram.PlatformResponse.SendMessage, "reply_markup"> {
    return { text, action: "sendMessage", chat_id: targetID };
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    quickReplies: Telegram.VisualContent.QuickReply.InlineMarkups
  ): Telegram.PlatformResponse.SendMessage.ReplyMarkup.InlineKeyboardMarkup {
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
    quickReplies: Telegram.VisualContent.QuickReply.ReplyMarkups
  ): Telegram.PlatformResponse.SendMessage.ReplyMarkup.ReplyKeyboardMarkup {
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
    quickReplies: Telegram.VisualContent.QuickReplies
  ): Telegram.PlatformResponse.SendMessage.ReplyMarkup {
    const shouldBeReplyMarkup = quickReplies.every(
      (qrs: Telegram.VisualContent.QuickReplies[number]) =>
        qrs.every(
          ({ type }: Telegram.VisualContent.QuickReplies[number][number]) => {
            return type === "location";
          }
        )
    );

    if (shouldBeReplyMarkup) {
      return createReplyMarkups(
        quickReplies as Telegram.VisualContent.QuickReply.ReplyMarkups
      );
    }

    return createInlineMarkups(
      quickReplies as Telegram.VisualContent.QuickReply.InlineMarkups
    );
  }

  function createPlatformResponse(
    targetID: string,
    { quickReplies, content }: Telegram.GenericResponse<C>["output"][number]
  ): Telegram.PlatformResponse {
    const tlQuickReplies = quickReplies && createQuickReplies(quickReplies);

    switch (content.type) {
      case "text":
        return {
          ...createTextResponse(targetID, content),
          reply_markup: tlQuickReplies
        };

      default:
        throw telegramError(`Unsupported content ${JSON.stringify(content)}`);
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
  communicator: Telegram.Communicator,
  ...transformers: readonly Transformer<Telegram.Messenger<C>>[]
): Promise<Telegram.Messenger<C>> {
  await communicator.setWebhook();
  const bot = await communicator.getCurrentBot();

  const baseMessenger = await createMessenger(
    {
      leafSelector,
      communicator,
      targetPlatform: "telegram",
      mapRequest: async req => createTelegramRequest(req, bot),
      mapResponse: async res => {
        return createTelegramResponse(res as Telegram.GenericResponse<C>);
      }
    },
    ...transformers
  );

  return {
    ...baseMessenger,
    sendResponse: async response => {
      const { targetID } = response;

      if (!!(await communicator.isMember(targetID, `${bot.id}`))) {
        return baseMessenger.sendResponse(response);
      }

      return {};
    }
  };
}
