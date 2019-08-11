import { DeepReadonly } from "ts-essentials";
import { DefaultContext as RootDefaultContext } from "./common";
import { PlatformCommunicator } from "./communicator";
import { Leaf as RootLeaf } from "./leaf";
import { Messenger as RootMessenger } from "./messenger";
import { GenericRequest as RootGenericRequest } from "./request";
import { GenericResponse as RootGenericResponse } from "./response";
import { VisualContent as RootVisualContent } from "./visual-content";

export namespace Telegram {
  namespace GenericRequest {
    interface Input extends RootGenericRequest.Base.Input {
      readonly inputCommand: string;
      readonly leftChatMembers: readonly (Bot | User)[];
      readonly newChatMembers: readonly (Bot | User)[];
      readonly targetPlatform: "telegram";
    }
  }

  interface GenericRequest<C> extends RootGenericRequest.Base<C> {
    readonly targetPlatform: "telegram";
    readonly telegramUser: User;
    readonly input: readonly GenericRequest.Input[];
  }

  interface GenericResponse<C> extends RootGenericResponse.Base<C> {
    readonly targetPlatform: "telegram";
    readonly output: readonly VisualContent[];
  }

  namespace VisualContent {
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

  interface VisualContent extends RootVisualContent.Base {
    readonly quickReplies?: VisualContent.QuickReplyMatrix;
  }

  type DefaultContext = RootDefaultContext & GenericRequest.Input;

  namespace Leaf {
    type Observer<C> = RootLeaf.Base.Observer<C, DefaultContext>;
  }

  type Leaf<C> = RootLeaf.Base<C, DefaultContext>;

  namespace PlatformRequest {
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
          readonly chat: PlatformRequest.Message.Message.Chat.Chat;
          readonly from: User;
          readonly message_id: number;
          readonly left_chat_participant: Bot | User;
          readonly left_chat_member: Bot | User;
        }

        interface NewChatMember {
          readonly chat: PlatformRequest.Message.Message.Chat.Chat;
          readonly from: User;
          readonly message_id: number;
          readonly new_chat_participant: Bot | User;
          readonly new_chat_member: Bot | User;
          readonly new_chat_members: readonly (Bot | User)[];
        }

        interface Text {
          readonly chat: PlatformRequest.Message.Message.Chat.Chat;
          readonly from: User;
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
        from: User;
        message: Message.Message;
        chat_instance: string;
        data: string;
      }>;

      readonly update_id: number;
    }
  }

  type PlatformRequest = PlatformRequest.Message | PlatformRequest.Callback;

  namespace PlatformResponse {
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

  type PlatformResponse = PlatformResponse.SendMessage;

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
  interface Communicator extends PlatformCommunicator<PlatformResponse> {
    /** Get the current chatbot. */
    getCurrentBot(): Promise<Bot>;

    /** Check if a bot is a member of a group. */
    isMember(chatID: string, botID: string): Promise<boolean>;

    /** Set webhook to start receiving message updates. */
    setWebhook(): Promise<unknown>;
  }

  /**
   * Represents a Telegram-specific messenger.
   * @template C The context used by the current chatbot.
   */
  interface Messenger<C>
    extends RootMessenger<C, PlatformRequest, GenericRequest<C>> {}
}
