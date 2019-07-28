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
      interface Contact extends RootVisualContent.Base.QuickReply {
        readonly type: "contact";
      }

      type InlineMarkup =
        | RootVisualContent.QuickReply.Postback
        | RootVisualContent.QuickReply.Text;

      type ReplyMarkup =
        | RootVisualContent.QuickReply.Location
        | RootVisualContent.QuickReply.Text
        | QuickReply.Contact;

      type InlineMarkups = readonly (readonly InlineMarkup[])[];
      type ReplyMarkups = readonly (readonly ReplyMarkup[])[];
    }

    type QuickReplies = QuickReply.InlineMarkups | QuickReply.ReplyMarkups;
  }

  interface VisualContent extends RootVisualContent.Base {
    readonly quickReplies?: VisualContent.QuickReplies;
  }

  type DefaultContext = RootDefaultContext & GenericRequest.Input;

  namespace Leaf {
    type Observer<C> = RootLeaf.Base.Observer<C, DefaultContext>;
  }

  type Leaf<C> = RootLeaf.Base<C, DefaultContext>;

  namespace PlatformRequest {
    namespace Base {
      namespace Message {
        interface Chat {
          readonly id: number;
        }
      }

      interface Message {
        readonly message_id: number;
        readonly from: User;
        readonly chat: SubContent.Message.Chat;
      }
    }

    interface Base {
      readonly update_id: number;
    }
  }

  namespace PlatformRequest {
    namespace SubContent {
      namespace Message {
        namespace Chat {
          interface Private extends Base.Message.Chat {
            readonly type: "private";
          }

          interface Group extends Base.Message.Chat {
            readonly type: "group";
          }
        }

        type Chat = Chat.Group | Chat.Private;

        interface LefChatMember extends Base.Message {
          left_chat_participant: Bot | User;
          left_chat_member: Bot | User;
        }

        interface NewChatMember extends Base.Message {
          new_chat_participant: Bot | User;
          new_chat_member: Bot | User;
          new_chat_members: readonly (Bot | User)[];
        }

        interface Text extends Base.Message {
          readonly text: string;
        }
      }

      type Message =
        | Message.LefChatMember
        | Message.NewChatMember
        | Message.Text;
    }

    /** Payload that includes on message field. */
    interface Message extends Base {
      readonly message: SubContent.Message;
    }

    /** Payload that includes callback field, usually for quick replies. */
    interface Callback extends Base {
      readonly callback_query: DeepReadonly<{
        id: string;
        from: User;
        message: SubContent.Message;
        chat_instance: string;
        data: string;
      }>;
    }
  }

  type PlatformRequest = PlatformRequest.Message | PlatformRequest.Callback;

  namespace PlatformResponse {
    namespace Base {
      namespace InlineKeyboardMarkup {
        interface Button {
          readonly text: string;
        }
      }
    }
  }

  namespace PlatformResponse {
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
        interface Postback extends Base.InlineKeyboardMarkup.Button {
          readonly callback_data: string;
        }

        interface URL extends Base.InlineKeyboardMarkup.Button {
          readonly url: string;
        }
      }

      type Button = Button.Postback | Button.URL;
    }

    interface InlineKeyboardMarkup {
      readonly inline_keyboard: readonly (readonly InlineKeyboardMarkup.Button[])[];
    }

    type ReplyMarkup = ReplyKeyboardMarkup | InlineKeyboardMarkup;

    interface HasReplyMarkup {
      readonly reply_markup: ReplyMarkup | undefined;
    }

    interface SendMessage extends HasReplyMarkup {
      readonly action: "sendMessage";
      readonly chat_id: string;
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
    namespace Base {
      interface APIResponse {
        readonly description: string;
      }
    }
  }

  namespace Communicator {
    namespace APIResponse {
      interface Success extends Base.APIResponse {
        readonly ok: true;
        readonly result: unknown;
      }

      interface Failure extends Base.APIResponse {
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
