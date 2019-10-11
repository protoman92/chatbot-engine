import { DeepReadonly } from "ts-essentials";
import { DefaultContext as RootDefaultContext } from "./common";
import { PlatformCommunicator } from "./communicator";
import { Leaf as RootLeaf } from "./leaf";
import { RootMessenger } from "./messenger";
import { RootGenericRequest, RootGenericRequestInput } from "./request";
import { RootGenericResponse } from "./response";
import { RootVisualContent } from "./visual-content";

export interface GenericTelegramRequestInput extends RootGenericRequestInput {
  readonly inputCommand: string;
  readonly leftChatMembers: readonly (Telegram.Bot | Telegram.User)[];
  readonly newChatMembers: readonly (Telegram.Bot | Telegram.User)[];
  readonly targetPlatform: "telegram";
}

export interface GenericTelegramRequest<C> extends RootGenericRequest<C> {
  readonly targetPlatform: "telegram";
  readonly telegramUser: Telegram.User;
  readonly input: readonly GenericTelegramRequestInput[];
}

export interface GenericTelegramResponse<C> extends RootGenericResponse<C> {
  readonly targetPlatform: "telegram";
  readonly output: readonly TelegramVisualContent[];
}

declare namespace TelegramVisualContent {
  namespace QuickReply {
    interface Contact {
      readonly text: string;
      readonly type: "contact";
    }

    type InlineMarkup =
      | RootVisualContent.QuickReply.Postback
      | RootVisualContent.QuickReply.Text;

    type ReplyMarkup =
      | RootVisualContent.QuickReply.Location
      | RootVisualContent.QuickReply.Text
      | QuickReply.Contact;

    type InlineMarkupMatrix = readonly (readonly InlineMarkup[])[];
    type ReplyMarkupMatrix = readonly (readonly ReplyMarkup[])[];
  }

  type QuickReplyMatrix =
    | QuickReply.InlineMarkupMatrix
    | QuickReply.ReplyMarkupMatrix;
}

export interface TelegramVisualContent extends RootVisualContent {
  readonly quickReplies?: TelegramVisualContent.QuickReplyMatrix;
}

declare namespace TelegramPlatformRequest {
  namespace Message {
    namespace Message {
      namespace Chat {
        namespace Chat {
          interface Private {
            readonly id: number;
            readonly type: "private";
          }

          interface Group {
            readonly id: number;
            readonly type: "group";
          }
        }

        type Chat = Chat.Group | Chat.Private;
      }

      interface LeftChatMember {
        readonly chat: TelegramPlatformRequest.Message.Message.Chat.Chat;
        readonly from: Telegram.User;
        readonly message_id: number;
        readonly left_chat_participant: Telegram.Bot | Telegram.User;
        readonly left_chat_member: Telegram.Bot | Telegram.User;
      }

      interface NewChatMember {
        readonly chat: TelegramPlatformRequest.Message.Message.Chat.Chat;
        readonly from: Telegram.User;
        readonly message_id: number;
        readonly new_chat_participant: Telegram.Bot | Telegram.User;
        readonly new_chat_member: Telegram.Bot | Telegram.User;
        readonly new_chat_members: readonly (Telegram.Bot | Telegram.User)[];
      }

      interface Text {
        readonly chat: TelegramPlatformRequest.Message.Message.Chat.Chat;
        readonly from: Telegram.User;
        readonly message_id: number;
        readonly text: string;
      }
    }

    type Message =
      | Message.LeftChatMember
      | Message.NewChatMember
      | Message.Text;
  }

  /** Payload that includes on message field. */
  interface Message {
    readonly message: Message.Message;
    readonly update_id: number;
  }

  /** Payload that includes callback field, usually for quick replies. */
  interface Callback {
    readonly callback_query: DeepReadonly<{
      id: string;
      from: Telegram.User;
      message: Message.Message;
      chat_instance: string;
      data: string;
    }>;

    readonly update_id: number;
  }
}

export type TelegramPlatformRequest =
  | TelegramPlatformRequest.Message
  | TelegramPlatformRequest.Callback;

declare namespace TelegramPlatformResponse {
  namespace SendMessage {
    namespace ReplyMarkup {
      namespace ReplyKeyboardMarkup {
        interface Button {
          readonly text: string;
          readonly request_contact: boolean | undefined;
          readonly request_location: boolean | undefined;
        }
      }

      interface ReplyKeyboardMarkup {
        readonly keyboard: readonly (readonly ReplyKeyboardMarkup.Button[])[];
        readonly resize_keyboard: boolean | undefined;
        readonly one_time_keyboard: boolean | undefined;
        readonly selective: boolean | undefined;
      }

      namespace InlineKeyboardMarkup {
        namespace Button {
          interface Postback {
            readonly callback_data: string;
            readonly text: string;
          }

          interface URL {
            readonly url: string;
            readonly text: string;
          }
        }

        type Button = Button.Postback | Button.URL;
      }

      interface InlineKeyboardMarkup {
        readonly inline_keyboard: readonly (readonly InlineKeyboardMarkup.Button[])[];
      }
    }

    type ReplyMarkup =
      | ReplyMarkup.ReplyKeyboardMarkup
      | ReplyMarkup.InlineKeyboardMarkup;
  }

  interface SendMessage {
    readonly action: "sendMessage";
    readonly chat_id: string;
    readonly reply_markup: SendMessage.ReplyMarkup | undefined;
    readonly text: string;
  }
}

export type TelegramPlatformResponse = TelegramPlatformResponse.SendMessage;

/**
 * Represents a Telegram-specific messenger.
 * @template C The context used by the current chatbot.
 */
export interface TelegramMessenger<C>
  extends RootMessenger<
    C,
    TelegramPlatformRequest,
    GenericTelegramRequest<C>
  > {}

export namespace Telegram {
  type DefaultContext = RootDefaultContext & GenericTelegramRequestInput;

  namespace Leaf {
    type Observer<C> = RootLeaf.Base.Observer<C, DefaultContext>;
  }

  type Leaf<C> = RootLeaf.Base<C, DefaultContext>;

  interface Bot {
    readonly id: number;
    readonly first_name: string;
    readonly username: string;
    readonly is_bot: boolean;
  }

  interface User extends Bot {
    readonly last_name: string;
    readonly language_code: "en";
  }

  /** Represents Telegram configurations. */
  interface Configs {
    readonly authToken: string;
    readonly webhookURL: string;
  }

  namespace Communicator {
    namespace APIResponse {
      interface Success {
        readonly description: string;
        readonly ok: true;
        readonly result: unknown;
      }

      interface Failure {
        readonly description: string;
        readonly ok: false;
      }
    }

    type APIResponse = APIResponse.Success | APIResponse.Failure;
  }

  /** A Telegram-specific communicator. */
  interface Communicator
    extends PlatformCommunicator<TelegramPlatformResponse> {
    /** Get the current chatbot. */
    getCurrentBot(): Promise<Bot>;

    /** Check if a bot is a member of a group. */
    isMember(chatID: string, botID: string): Promise<boolean>;

    /** Set webhook to start receiving message updates. */
    setWebhook(): Promise<unknown>;
  }
}
