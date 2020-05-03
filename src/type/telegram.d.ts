import { DeepReadonly } from "ts-essentials";
import { DefaultContext as RootDefaultContext } from "./common";
import { PlatformCommunicator } from "./communicator";
import { Leaf as RootLeaf } from "./leaf";
import { BaseMessageProcessor } from "./messenger";
import { BaseRequest, BaseRequestInput } from "./request";
import { BaseResponse } from "./response";
import { BaseResponseOutput } from "./visual-content";

export interface TelegramRequestInput extends BaseRequestInput {
  readonly inputCommand: string;
  readonly leftChatMembers: readonly (TelegramBot | TelegramUser)[];
  readonly newChatMembers: readonly (TelegramBot | TelegramUser)[];
  readonly targetPlatform: "telegram";
}

export interface TelegramRequest<C> extends BaseRequest<C> {
  readonly targetPlatform: "telegram";
  readonly telegramUser: TelegramUser;
  readonly input: readonly TelegramRequestInput[];
}

export interface TelegramResponse<C> extends BaseResponse<C> {
  readonly targetPlatform: "telegram";
  readonly output: readonly TelegramResponseOutput[];
}

declare namespace TelegramResponseOutput {
  namespace QuickReply {
    interface Contact {
      readonly text: string;
      readonly type: "contact";
    }

    type InlineMarkup =
      | BaseResponseOutput.QuickReply.Postback
      | BaseResponseOutput.QuickReply.Text;

    type ReplyMarkup =
      | BaseResponseOutput.QuickReply.Location
      | BaseResponseOutput.QuickReply.Text
      | QuickReply.Contact;

    type InlineMarkupMatrix = readonly (readonly InlineMarkup[])[];
    type ReplyMarkupMatrix = readonly (readonly ReplyMarkup[])[];
  }

  type QuickReplyMatrix =
    | QuickReply.InlineMarkupMatrix
    | QuickReply.ReplyMarkupMatrix;
}

export interface TelegramResponseOutput extends BaseResponseOutput {
  readonly quickReplies?: TelegramResponseOutput.QuickReplyMatrix;
}

declare namespace TelegramRawRequest {
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
        readonly chat: TelegramRawRequest.Message.Message.Chat.Chat;
        readonly from: TelegramUser;
        readonly message_id: number;
        readonly left_chat_participant: TelegramBot | TelegramUser;
        readonly left_chat_member: TelegramBot | TelegramUser;
      }

      interface NewChatMember {
        readonly chat: TelegramRawRequest.Message.Message.Chat.Chat;
        readonly from: TelegramUser;
        readonly message_id: number;
        readonly new_chat_participant: TelegramBot | TelegramUser;
        readonly new_chat_member: TelegramBot | TelegramUser;
        readonly new_chat_members: readonly (TelegramBot | TelegramUser)[];
      }

      interface Text {
        readonly chat: TelegramRawRequest.Message.Message.Chat.Chat;
        readonly from: TelegramUser;
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
      from: TelegramUser;
      message: Message.Message;
      chat_instance: string;
      data: string;
    }>;

    readonly update_id: number;
  }
}

export type TelegramRawRequest =
  | TelegramRawRequest.Message
  | TelegramRawRequest.Callback;

declare namespace TelegramRawResponse {
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

export type TelegramRawResponse = TelegramRawResponse.SendMessage;

/**
 * Represents a Telegram-specific message processor.
 * @template C The context used by the current chatbot.
 */
export interface TelegramMessageProcessor<C>
  extends BaseMessageProcessor<C, TelegramRawRequest, TelegramRequest<C>> {}

export type TelegramDefaultContext = RootDefaultContext & TelegramRequestInput;

declare namespace TelegramLeaf {
  type Observer<C> = RootLeaf.Base.Observer<C, TelegramDefaultContext>;
}

export type TelegramLeaf<C> = RootLeaf.Base<C, TelegramDefaultContext>;

export interface TelegramBot {
  readonly id: number;
  readonly first_name: string;
  readonly username: string;
  readonly is_bot: boolean;
}

export interface TelegramUser extends TelegramBot {
  readonly last_name: string;
  readonly language_code: "en";
}

/** Represents Telegram configurations. */
export interface TelegramConfigs {
  readonly authToken: string;
  readonly webhookURL: string;
}

declare namespace TelegramCommunicator {
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
export interface TelegramCommunicator
  extends PlatformCommunicator<TelegramRawResponse> {
  /** Get the current chatbot. */
  getCurrentBot(): Promise<TelegramBot>;

  /** Check if a bot is a member of a group. */
  isMember(chatID: string, botID: string): Promise<boolean>;

  /** Set webhook to start receiving message updates. */
  setWebhook(): Promise<unknown>;
}
