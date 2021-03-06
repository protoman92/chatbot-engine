import FormData from "form-data";
import { ReadStream } from "fs";
import { PlatformClient } from "./client";
import { Coordinates } from "./common";
import { LeafSelector } from "./leaf";
import { BaseMessageProcessor } from "./messenger";
import { BaseRequest, CrossPlatformRequestInput } from "./request";
import { BaseResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";
import { BaseResponseOutput } from "./visual-content";

export type TelegramRequestInput<Context> =
  | Readonly<{ command: string; text?: string; type: "command" }>
  | Readonly<{ coordinate: Coordinates; type: "location" }>
  | Readonly<{ document: TelegramRawRequest.DocumentDetails; type: "document" }>
  | Readonly<{
      images: readonly TelegramRawRequest.PhotoDetails[];
      type: "image";
    }>
  | Readonly<{
      leftChatMembers: readonly (TelegramBot | TelegramUser)[];
      type: "left_chat";
    }>
  | Readonly<{
      newChatMembers: readonly (TelegramBot | TelegramUser)[];
      type: "joined_chat";
    }>
  | Readonly<{ payload: string; type: "postback" }>
  | CrossPlatformRequestInput<Context>;

type CommonTelegramRequest<Context> = Readonly<{
  targetPlatform: "telegram";
}> &
  BaseRequest<Context>;

export type TelegramRequest<Context> = CommonTelegramRequest<Context> &
  (
    | Readonly<{
        currentBot: TelegramBot;
        telegramUser: TelegramUser;
        input: TelegramRequestInput<Context>;
        type: "message_trigger";
      }>
    | Readonly<{ input: TelegramRequestInput<Context>; type: "manual_trigger" }>
  );

export interface TelegramResponse<Context> extends BaseResponse<Context> {
  readonly output: readonly TelegramResponseOutput[];
  readonly targetPlatform: "telegram";
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

    interface URL {
      readonly text: string;
      readonly type: "url";
      readonly url: string;
    }
  }

  type InlineMarkup = QuickReply.Postback | QuickReply.Text | QuickReply.URL;
  type ReplyMarkup = QuickReply.Location | QuickReply.Text | QuickReply.Contact;
  type InlineMarkupMatrix = readonly (readonly InlineMarkup[])[];
  type ReplyMarkupMatrix = readonly (readonly ReplyMarkup[])[];

  interface InlineMarkupQuickReply {
    readonly content: InlineMarkupMatrix;
    readonly type: "inline_markup";
  }

  interface ReplyMarkupQuickReply {
    readonly content: ReplyMarkupMatrix;
    readonly type: "reply_markup";
  }

  interface RemoveReplyKeyboardQuickReply {
    readonly type: "remove_reply_keyboard";
  }

  type QuickReply =
    | ReplyMarkupQuickReply
    | InlineMarkupQuickReply
    | RemoveReplyKeyboardQuickReply;
}

declare namespace TelegramResponseOutput {
  namespace Content {
    interface Document {
      fileData: ReadStream;
      fileName?: string;
      text?: string;
      type: "document";
    }

    interface Image {
      readonly image: string;
      readonly text?: string;
      readonly type: "image";
    }

    interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  type Content = Content.Document | Content.Image | Content.Text;
}

export interface TelegramResponseOutput extends BaseResponseOutput {
  readonly content: TelegramResponseOutput.Content;
  readonly quickReplies?: TelegramResponseOutput.QuickReply;
  readonly parseMode?: "html" | "markdown";
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
      readonly left_chat_member: TelegramBot | TelegramUser;
    }

    interface Location {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly location: Coordinates;
      readonly message_id: number;
    }

    interface NewChatMember {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
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
      | Message.Location
      | Message.NewChatMember
      | Message.Photo
      | Message.Text;
    readonly update_id: number;
  }

  /** Payload that includes callback field, usually for quick replies */
  interface Callback {
    readonly callback_query: Readonly<{
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
  type ParseMode = "html" | "markdown";

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

    interface ReplyKeyboardRemove {
      readonly remove_keyboard: true;
    }
  }

  type ReplyMarkup =
    | ReplyMarkup.ReplyKeyboardMarkup
    | ReplyMarkup.InlineKeyboardMarkup
    | ReplyMarkup.ReplyKeyboardRemove;

  type SendDocument = FormData;

  interface SendMessage {
    readonly text: string;
  }

  interface SendPhoto {
    readonly caption?: string;
    readonly photo: string;
  }
}

export type TelegramRawResponse = Readonly<
  {
    headers?: Readonly<{ [x: string]: string }>;
    parseMode?: TelegramRawResponse.ParseMode;
  } & (
    | {
        action: "sendDocument";
        body: TelegramRawResponse.SendDocument;
      }
    | {
        action: "sendMessage";
        body: TelegramRawResponse.SendMessage &
          Readonly<{
            chat_id: string;
            reply_markup?: TelegramRawResponse.ReplyMarkup;
          }>;
      }
    | {
        action: "sendPhoto";
        body: TelegramRawResponse.SendPhoto &
          Readonly<{
            chat_id: string;
            reply_markup?: TelegramRawResponse.ReplyMarkup;
          }>;
      }
  )
>;

interface TelegramMessageProcessorConfig<Context> {
  readonly leafSelector: LeafSelector<Context>;
  readonly client: TelegramClient;
}

/** Represents a Telegram-specific message processor */
export interface TelegramMessageProcessor<Context>
  extends BaseMessageProcessor<Context> {}

export type TelegramDefaultContext = {};

export type TelegramLeafObserver<T> = ContentObserver<
  TelegramRequest<T & TelegramDefaultContext>
>;

export type TelegramLeaf<T> = TelegramLeafObserver<T> &
  ContentObservable<TelegramResponse<T>>;

export interface TelegramBot {
  readonly id: number;
  readonly first_name: string;
  readonly username: string;
}

export interface TelegramUser extends TelegramBot {
  readonly is_bot: boolean;
  readonly last_name: string;
  readonly language_code: "en";
}

/** Represents Telegram configurations */
export interface TelegramConfig {
  readonly authToken: string;
  readonly defaultParseMode?: TelegramRawResponse.ParseMode;
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

  /** Convenience method to get a file's URL using its ID */
  getFileURLFromID(fileID: string): Promise<string>;

  /** Check if a bot is a member of a group */
  isMember(chatID: string, botID: string): Promise<boolean>;

  /** Set webhook to start receiving message updates */
  setWebhook(): Promise<unknown>;
}

export interface SaveTelegramUserContext<Context> {
  readonly additionalContext?: Partial<Context>;
  readonly telegramUserID: number;
}
