import FormData from "form-data";
import { ReadStream } from "fs";
import { StrictOmit } from "ts-essentials";
import {
  GenericRequestReceiver,
  GenericResponseSender,
  MessageProcessorMiddleware,
  RawRequestGeneralizer,
} from ".";
import { PlatformClient } from "./client";
import { Coordinates } from "./common";
import { LeafSelector } from "./leaf";
import {
  BaseRequest,
  CrossPlatformRequestInput,
  GenericManualTriggerRequest,
  GenericMessageTriggerRequest,
} from "./request";
import { BaseGenericResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";
import { BaseGenericResponseOutput } from "./visual-content";

export type TelegramGenericRequestInput = Readonly<
  | { command: string; text?: string | undefined; type: "command" }
  | { coordinate: Coordinates; type: "location" }
  | {
      document: _TelegramRawRequest.DocumentDetails;
      type: "document";
    }
  | {
      images: readonly _TelegramRawRequest.PhotoDetails[];
      type: "image";
    }
  | {
      leftChatMembers: readonly (TelegramBot | TelegramUser)[];
      type: "left_chat";
    }
  | {
      newChatMembers: readonly (TelegramBot | TelegramUser)[];
      type: "joined_chat";
    }
  | { payload: string; type: "postback" }
  /**
   * Need to answer this with a pre-checkout confirmation response for the
   * payment to go through.
   */
  | {
      amount: number;
      checkoutID: string;
      currency: string;
      payload: string;
      type: "pre_checkout";
    }
  | {
      amount: number;
      currency: string;
      payload: string;
      providerPaymentChargeID: string;
      telegramPaymentChargeID: string;
      type: "successful_payment";
    }
  | { video: _TelegramRawRequest.VideoDetails; type: "video" }
  | CrossPlatformRequestInput
>;

export type TelegramGenericRequest = Readonly<
  {
    targetPlatform: "telegram";
  } & BaseRequest &
    (
      | (GenericMessageTriggerRequest<TelegramRawRequest> & {
          currentBot: TelegramBot;
          telegramUser: TelegramUser;
          input: TelegramGenericRequestInput;
        })
      | (GenericManualTriggerRequest & {
          input: TelegramGenericRequestInput;
        })
    )
>;

export interface TelegramGenericResponse extends BaseGenericResponse {
  readonly output: readonly TelegramGenericResponseOutput[];
  readonly targetPlatform: "telegram";
}

export namespace _TelegramGenericResponseOutput {
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

    export namespace Invoice {
      export interface Price {
        readonly amount: number;
        readonly label: string;
      }
    }

    export interface Invoice {
      readonly currency: string;
      readonly description: string;
      readonly payload: string;
      readonly prices: readonly Invoice.Price[];
      readonly title: string;
      readonly type: "invoice";
    }

    export type PreCheckoutConfirmation = Readonly<
      {
        checkoutID: string;
        type: "pre_checkout_confirmation";
      } & (
        | { error: Error | string; isOK?: undefined }
        | { error?: undefined; isOK: true }
      )
    >;

    export interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  export type Content =
    | Content.Document
    | Content.Image
    | Content.Invoice
    | Content.PreCheckoutConfirmation
    | Content.Text;
}

export interface TelegramGenericResponseOutput
  extends BaseGenericResponseOutput {
  readonly content: _TelegramGenericResponseOutput.Content;
  readonly quickReplies?: _TelegramGenericResponseOutput.QuickReply;
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

  export interface VideoDetails {
    readonly duration: number;
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

    export interface Video {
      readonly chat: Chat;
      readonly date: number;
      readonly from: TelegramUser;
      readonly message_id: number;
      readonly video: VideoDetails;
    }
  }

  export interface Message {
    readonly message:
      | Message.Document
      | Message.LeftChatMember
      | Message.Location
      | Message.NewChatMember
      | Message.Photo
      | Message.Text
      | Message.Video;
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

  export interface PreCheckout {
    readonly pre_checkout_query: Readonly<{
      currency: string;
      from: TelegramUser;
      id: string;
      invoice_payload: string;
      total_amount: number;
    }>;
    readonly update_id: number;
  }

  export interface SuccessfulPayment {
    readonly message: Readonly<{
      chat: Chat;
      date: number;
      from: TelegramUser;
      message_id: number;
      successful_payment: Readonly<{
        currency: string;
        invoice_payload: string;
        provider_payment_charge_id: string;
        telegram_payment_charge_id: string;
        total_amount: number;
      }>;
    }>;
    readonly update_id: number;
  }
}

export type TelegramRawRequest =
  | _TelegramRawRequest.Message
  | _TelegramRawRequest.Callback
  | _TelegramRawRequest.PreCheckout
  | _TelegramRawRequest.SuccessfulPayment;

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

  export interface AnswerPreCheckoutQuery {
    readonly error_message: string | undefined;
    readonly ok: boolean;
    readonly pre_checkout_query_id: string;
  }

  export type SendDocument = FormData;

  export interface SendInvoice
    extends StrictOmit<
      _TelegramGenericResponseOutput.Content.Invoice,
      "type"
    > {}

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
    parseMode?: _TelegramRawResponse.ParseMode | undefined;
  } & (
    | {
        action: "answerPreCheckoutQuery";
        body: _TelegramRawResponse.AnswerPreCheckoutQuery &
          Readonly<{ chat_id: string }>;
      }
    | {
        action: "sendDocument";
        body: _TelegramRawResponse.SendDocument;
      }
    | {
        action: "sendInvoice";
        body: _TelegramRawResponse.SendInvoice & Readonly<{ chat_id: string }>;
      }
    | {
        action: "sendMessage";
        body: _TelegramRawResponse.SendMessage &
          Readonly<{
            chat_id: string;
            reply_markup?: _TelegramRawResponse.ReplyMarkup | undefined;
          }>;
      }
    | {
        action: "sendPhoto";
        body: _TelegramRawResponse.SendPhoto &
          Readonly<{
            chat_id: string;
            reply_markup?: _TelegramRawResponse.ReplyMarkup | undefined;
          }>;
      }
  )
>;

export interface TelegramMessageProcessorConfig {
  readonly leafSelector: LeafSelector;
  readonly client: TelegramClient;
}

/** Represents a Telegram-specific message processor */
export interface TelegramMessageProcessor
  extends RawRequestGeneralizer<TelegramRawRequest, TelegramGenericRequest>,
    GenericRequestReceiver<TelegramGenericRequest>,
    GenericResponseSender<
      TelegramGenericResponse,
      readonly (
        | _TelegramRawRequest.Message["message"]
        /** If response is pre_checkout_confirmation */
        | true
      )[]
    > {}

export type TelegramMessageProcessorMiddleware = MessageProcessorMiddleware<
  TelegramMessageProcessor
>;

export type TelegramLeafObserver = ContentObserver<TelegramGenericRequest>;

export type TelegramLeaf = TelegramLeafObserver &
  ContentObservable<TelegramGenericResponse>;

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
  readonly defaultPaymentProviderToken?: string;
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
  deleteMessage(
    args: Readonly<{ chatID: number | string; messageID: number | string }>
  ): Promise<void>;

  /** Get the current chatbot */
  getCurrentBot(): Promise<TelegramBot>;

  /** Get a file using its ID */
  getFile(fileID: string): Promise<_TelegramRawRequest.FileDetails>;

  /** Get the URL to a file in Telegram */
  getFileURL(filePath: string): Promise<string>;

  /** Convenience method to get a file's URL using its ID */
  getFileURLFromID(fileID: string): Promise<string>;

  /** Check if a bot is a member of a group */
  isMember(args: Readonly<{ chatID: string; botID: string }>): Promise<boolean>;

  /** Set webhook to start receiving message updates */
  setWebhook(webhookURL: string): Promise<unknown>;
}
