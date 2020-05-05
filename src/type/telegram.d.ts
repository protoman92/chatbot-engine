import { DeepReadonly } from "ts-essentials";
import { PlatformClient } from "./client";
import { DefaultContext as RootDefaultContext } from "./common";
import { BaseLeaf, BaseLeafObserver } from "./leaf";
import { BaseMessageProcessor } from "./messenger";
import { BaseRequest, BaseRequestInput } from "./request";
import { BaseResponse } from "./response";
import { BaseResponseOutput } from "./visual-content";

export interface TelegramRequestInput extends BaseRequestInput {
  readonly inputCommand: string;
  readonly inputDocument?: TelegramRawRequest.DocumentDetails;
  readonly inputPhotos: readonly TelegramRawRequest.PhotoDetails[];
  readonly leftChatMembers: readonly (TelegramBot | TelegramUser)[];
  readonly newChatMembers: readonly (TelegramBot | TelegramUser)[];
  readonly targetPlatform: "telegram";
}

export interface TelegramRequest<Context> extends BaseRequest<Context> {
  readonly targetPlatform: "telegram";
  readonly telegramUser: TelegramUser;
  readonly input: readonly TelegramRequestInput[];
}

export interface TelegramResponse<Context> extends BaseResponse<Context> {
  readonly targetPlatform: "telegram";
  readonly output: readonly TelegramResponseOutput[];
}

declare namespace TelegramResponseOutput {
  namespace QuickReply {
    interface Contact {
      readonly text: string;
      readonly type: "contact";
    }

    interface Location {
      readonly text: string;
      readonly type: "location";
    }

    interface Postback {
      readonly payload: string;
      readonly text: string;
      readonly type: "postback";
    }

    interface Text {
      readonly text: string;
      readonly type: "text";
    }

    type InlineMarkup = QuickReply.Postback | QuickReply.Text;

    type ReplyMarkup =
      | QuickReply.Location
      | QuickReply.Text
      | QuickReply.Contact;

    type InlineMarkupMatrix = readonly (readonly InlineMarkup[])[];
    type ReplyMarkupMatrix = readonly (readonly ReplyMarkup[])[];
  }

  type QuickReplyMatrix =
    | QuickReply.InlineMarkupMatrix
    | QuickReply.ReplyMarkupMatrix;
}

declare namespace TelegramResponseOutput {
  namespace Content {
    interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  type Content = Content.Text;
}

export interface TelegramResponseOutput extends BaseResponseOutput {
  readonly content: TelegramResponseOutput.Content;
  readonly quickReplies?: TelegramResponseOutput.QuickReplyMatrix;
}

declare namespace TelegramRawRequest {
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

  interface DocumentDetails {
    readonly file_name: string;
    readonly mime_type: string;
    readonly thumb: Readonly<{
      file_id: string;
      file_unique_id: string;
      file_size: number;
      width: number;
      height: number;
    }>;
    readonly file_id: string;
    readonly file_unique_id: string;
    readonly file_size: number;
  }

  interface FileDetails {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
  }

  interface PhotoDetails {
    readonly file_id: string;
    readonly file_unique_id: string;
    readonly file_size: number;
    readonly width: number;
    readonly height: number;
  }

  namespace Message {
    interface Document {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly document: DocumentDetails;
    }

    interface LeftChatMember {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly left_chat_participant: TelegramBot | TelegramUser;
      readonly left_chat_member: TelegramBot | TelegramUser;
    }

    interface NewChatMember {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly new_chat_participant: TelegramBot | TelegramUser;
      readonly new_chat_member: TelegramBot | TelegramUser;
      readonly new_chat_members: readonly (TelegramBot | TelegramUser)[];
    }

    interface Photo {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly photo: readonly PhotoDetails[];
    }

    interface Text {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly text: string;
    }
  }

  /** Payload that includes on message field */
  interface Message {
    readonly message:
      | Message.Document
      | Message.LeftChatMember
      | Message.NewChatMember
      | Message.Photo
      | Message.Text;
    readonly update_id: number;
  }

  /** Payload that includes callback field, usually for quick replies */
  interface Callback {
    readonly callback_query: DeepReadonly<{
      id: string;
      from: TelegramUser;
      chat_instance: string;
      data: string;
    }> &
      Pick<Message, "message">;

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

/** Represents a Telegram-specific message processor */
export interface TelegramMessageProcessor<Context>
  extends BaseMessageProcessor<
    Context,
    TelegramRawRequest,
    TelegramRequest<Context>
  > {}

export type TelegramDefaultContext = RootDefaultContext & TelegramRequestInput;

export type TelegramLeafObserver<Context> = BaseLeafObserver<
  Context,
  TelegramDefaultContext
>;

export type TelegramLeaf<Context> = BaseLeaf<Context, TelegramDefaultContext>;

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

/** Represents Telegram configurations */
export interface TelegramConfigs {
  readonly authToken: string;
  readonly webhookURL: string;
}

declare namespace TelegramClient {
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

/** A Telegram-specific client */
export interface TelegramClient extends PlatformClient<TelegramRawResponse> {
  /** Get the current chatbot */
  getCurrentBot(): Promise<TelegramBot>;

  /** Get a file using its ID */
  getFile(fileID: string): Promise<TelegramRawRequest.FileDetails>;

  /** Get the URL to a file in Telegram */
  getFileURL(filePath: string): Promise<string>;

  /** Check if a bot is a member of a group */
  isMember(chatID: string, botID: string): Promise<boolean>;

  /** Set webhook to start receiving message updates */
  setWebhook(): Promise<unknown>;
}

export interface SaveTelegramUserContext<Context> {
  readonly additionalContext: Partial<Context>;
  readonly telegramUserID: string;
}
