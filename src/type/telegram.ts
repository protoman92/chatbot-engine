import FormData from "form-data";
import { ReadStream } from "fs";
import { MessageProcessorMiddleware } from ".";
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
  | Readonly<{
      document: _TelegramRawRequest.DocumentDetails;
      type: "document";
    }>
  | Readonly<{
      images: readonly _TelegramRawRequest.PhotoDetails[];
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

export namespace _TelegramResponseOutput {
  export namespace QuickReply {
    export interface Contact {
      readonly text: string;
      readonly type: "contact";
    }

    export interface Location {
      readonly text: string;
      readonly type: "location";
    }

    export interface Postback {
      readonly payload: string;
      readonly text: string;
      readonly type: "postback";
    }

    export interface Text {
      readonly text: string;
      readonly type: "text";
    }

    export interface URL {
      readonly text: string;
      readonly type: "url";
      readonly url: string;
    }
  }

  export type InlineMarkup =
    | QuickReply.Postback
    | QuickReply.Text
    | QuickReply.URL;

  export type ReplyMarkup =
    | QuickReply.Location
    | QuickReply.Text
    | QuickReply.Contact;

  export type InlineMarkupMatrix = readonly (readonly InlineMarkup[])[];
  export type ReplyMarkupMatrix = readonly (readonly ReplyMarkup[])[];

  export interface InlineMarkupQuickReply {
    readonly content: InlineMarkupMatrix;
    readonly type: "inline_markup";
  }

  export interface ReplyMarkupQuickReply {
    readonly content: ReplyMarkupMatrix;
    readonly type: "reply_markup";
  }

  export interface RemoveReplyKeyboardQuickReply {
    readonly type: "remove_reply_keyboard";
  }

  export type QuickReply =
    | ReplyMarkupQuickReply
    | InlineMarkupQuickReply
    | RemoveReplyKeyboardQuickReply;

  export namespace Content {
    export interface Document {
      readonly fileData: ReadStream;
      readonly fileName?: string;
      readonly text?: string;
      readonly type: "document";
    }

    export interface Image {
      readonly image: string;
      readonly text?: string;
      readonly type: "image";
    }

    export interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  export type Content = Content.Document | Content.Image | Content.Text;
}

export interface TelegramResponseOutput extends BaseResponseOutput {
  readonly content: _TelegramResponseOutput.Content;
  readonly quickReplies?: _TelegramResponseOutput.QuickReply;
  readonly parseMode?: "html" | "markdown";
}

export namespace _TelegramRawRequest {
  namespace Chat {
    export interface Private {
      readonly id: number;
      readonly type: "private";
    }

    export interface Group {
      readonly id: number;
      readonly type: "group";
    }
  }

  export type Chat = Chat.Group | Chat.Private;

  export interface DocumentDetails {
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

  export interface FileDetails {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
  }

  export interface PhotoDetails {
    readonly file_id: string;
    readonly file_unique_id: string;
    readonly file_size: number;
    readonly width: number;
    readonly height: number;
  }

  export namespace Message {
    export interface Document {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly document: DocumentDetails;
    }

    export interface LeftChatMember {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly left_chat_member: TelegramBot | TelegramUser;
    }

    export interface Location {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly location: Coordinates;
      readonly message_id: number;
    }

    export interface NewChatMember {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly new_chat_members: readonly (TelegramBot | TelegramUser)[];
    }

    export interface Photo {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly photo: readonly PhotoDetails[];
    }

    export interface Text {
      readonly chat: Chat;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly text: string;
    }
  }

  /** Payload that includes on message field */
  export interface Message {
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
  export interface Callback {
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
  | _TelegramRawRequest.Message
  | _TelegramRawRequest.Callback;

export namespace _TelegramRawResponse {
  export type ParseMode = "html" | "markdown";

  export namespace ReplyMarkup {
    export namespace ReplyKeyboardMarkup {
      export interface Button {
        readonly text: string;
        readonly request_contact: boolean | undefined;
        readonly request_location: boolean | undefined;
      }
    }

    export interface ReplyKeyboardMarkup {
      readonly keyboard: readonly (readonly ReplyKeyboardMarkup.Button[])[];
      readonly resize_keyboard: boolean | undefined;
      readonly one_time_keyboard: boolean | undefined;
      readonly selective: boolean | undefined;
    }

    export namespace InlineKeyboardMarkup {
      export namespace Button {
        export interface Postback {
          readonly callback_data: string;
          readonly text: string;
        }

        export interface URL {
          readonly url: string;
          readonly text: string;
        }
      }

      export type Button = Button.Postback | Button.URL;
    }

    export interface InlineKeyboardMarkup {
      readonly inline_keyboard: readonly (readonly InlineKeyboardMarkup.Button[])[];
    }

    export interface ReplyKeyboardRemove {
      readonly remove_keyboard: true;
    }
  }

  export type ReplyMarkup =
    | ReplyMarkup.ReplyKeyboardMarkup
    | ReplyMarkup.InlineKeyboardMarkup
    | ReplyMarkup.ReplyKeyboardRemove;

  export type SendDocument = FormData;

  export interface SendMessage {
    readonly text: string;
  }

  export interface SendPhoto {
    readonly caption?: string;
    readonly photo: string;
  }
}

export type TelegramRawResponse = Readonly<
  {
    headers?: Readonly<{ [x: string]: string }>;
    parseMode?: _TelegramRawResponse.ParseMode;
  } & (
    | {
        action: "sendDocument";
        body: _TelegramRawResponse.SendDocument;
      }
    | {
        action: "sendMessage";
        body: _TelegramRawResponse.SendMessage &
          Readonly<{
            chat_id: string;
            reply_markup?: _TelegramRawResponse.ReplyMarkup;
          }>;
      }
    | {
        action: "sendPhoto";
        body: _TelegramRawResponse.SendPhoto &
          Readonly<{
            chat_id: string;
            reply_markup?: _TelegramRawResponse.ReplyMarkup;
          }>;
      }
  )
>;

export interface TelegramMessageProcessorConfig<Context> {
  readonly leafSelector: LeafSelector<Context>;
  readonly client: TelegramClient;
}

/** Represents a Telegram-specific message processor */
export interface TelegramMessageProcessor<Context>
  extends BaseMessageProcessor<Context, TelegramRawRequest> {}

export type TelegramMessageProcessorMiddleware<
  Context
> = MessageProcessorMiddleware<Context, TelegramMessageProcessor<Context>>;

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
  readonly defaultParseMode?: _TelegramRawResponse.ParseMode;
}

export namespace _TelegramClient {
  export namespace APIResponse {
    export interface Success<Result> {
      readonly description: string;
      readonly ok: true;
      readonly result: Result;
    }

    export interface Failure {
      readonly description: string;
      readonly ok: false;
    }
  }

  export type APIResponse<Result> =
    | APIResponse.Success<Result>
    | APIResponse.Failure;
}

/** A Telegram-specific client */
export interface TelegramClient extends PlatformClient<TelegramRawResponse> {
  /** Get the current chatbot */
  getCurrentBot(): Promise<TelegramBot>;

  /** Get a file using its ID */
  getFile(fileID: string): Promise<_TelegramRawRequest.FileDetails>;

  /** Get the URL to a file in Telegram */
  getFileURL(filePath: string): Promise<string>;

  /** Convenience method to get a file's URL using its ID */
  getFileURLFromID(fileID: string): Promise<string>;

  /** Check if a bot is a member of a group */
  isMember(chatID: string, botID: string): Promise<boolean>;

  /** Set webhook to start receiving message updates */
  setWebhook(webhookURL: string): Promise<unknown>;
}
