import FormData from "form-data";
import { ReadStream } from "fs";
import { StrictOmit } from "ts-essentials";
import {
  GenericRequestReceiver,
  GenericResponseSender,
  MessageProcessorMiddleware,
  RawRequestGeneralizer,
} from ".";
import { NextResult } from "../content/leaf";
import {
  PlatformClientResponseSender,
  PlatformClientTypingIndicatorSetter,
} from "./client";
import { Coordinates } from "./common";
import { LeafSelector } from "./leaf";
import {
  CommonGenericRequest,
  GenericManualTriggerRequest,
  GenericMessageTriggerRequest,
} from "./request";
import { BaseGenericResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";
import { BaseGenericResponseOutput } from "./visual-content";

export namespace TelegramGenericRequest {
  interface BaseRequest extends CommonGenericRequest {
    readonly targetPlatform: "telegram";
  }

  export interface ManualTrigger
    extends BaseRequest,
      GenericManualTriggerRequest {}

  export interface MessageTrigger
    extends BaseRequest,
      StrictOmit<GenericMessageTriggerRequest<TelegramRawRequest>, "input"> {
    readonly chatType: TelegramRawRequest.Chat["type"] | undefined;
    readonly currentBot: TelegramBot;
    readonly telegramUser: TelegramUser;
    readonly input: Readonly<
      | {
          command: string;
          /**
           * In a group setting, the user may ping another bot's command, so
           * this command can be used to determine if this bot should respond.
           */
          isMeantForThisBot: boolean;
          pingedBotUsername: string | undefined;
          text: string | undefined;
          type: "telegram.command";
        }
      | {
          newMember: TelegramChatMember;
          oldMember: TelegramChatMember;
          type: "telegram.chat_member_updated";
        }
      | { coordinate: Coordinates; type: "location" }
      | {
          document: TelegramRawRequest.DocumentDetails;
          type: "telegram.document";
        }
      | {
          images: readonly TelegramRawRequest.PhotoDetails[];
          type: "telegram.image";
        }
      | {
          areAllMembersAdministrators: boolean;
          groupName: string;
          type: "telegram.group_chat_created";
        }
      | {
          leftChatMembers: readonly (TelegramBot | TelegramUser)[];
          type: "telegram.left_chat";
        }
      | {
          newChatMembers: readonly (TelegramBot | TelegramUser)[];
          type: "telegram.joined_chat";
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
          type: "telegram.pre_checkout";
        }
      | {
          amount: number;
          currency: string;
          payload: string;
          providerPaymentChargeID: string;
          telegramPaymentChargeID: string;
          type: "telegram.successful_payment";
        }
      | { video: TelegramRawRequest.VideoDetails; type: "telegram.video" }
      | GenericMessageTriggerRequest<TelegramRawRequest>["input"]
    >;
  }
}

export type TelegramGenericRequest =
  | TelegramGenericRequest.ManualTrigger
  | TelegramGenericRequest.MessageTrigger;

export interface TelegramGenericResponse extends BaseGenericResponse {
  readonly output: readonly TelegramGenericResponseOutput[];
  readonly targetPlatform: "telegram";
}

export namespace TelegramGenericResponseOutput {
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
    readonly type: "telegram.inline_markup";
  }

  export interface ReplyMarkupQuickReply {
    readonly content: ReplyMarkupMatrix;
    readonly type: "telegram.reply_markup";
  }

  export interface RemoveReplyKeyboardQuickReply {
    readonly type: "telegram.remove_reply_keyboard";
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
      readonly type: "telegram.document";
    }

    export interface Image {
      readonly image: string;
      readonly text?: string;
      readonly type: "telegram.image";
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
      readonly type: "telegram.invoice";
    }

    export type PreCheckoutConfirmation = Readonly<
      {
        checkoutID: string;
        type: "telegram.pre_checkout_confirmation";
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
  readonly content: TelegramGenericResponseOutput.Content;
  readonly quickReplies?: TelegramGenericResponseOutput.QuickReply;
  readonly parseMode?: "html" | "markdown";
}

export namespace TelegramRawRequest {
  namespace Chat {
    export interface Private {
      readonly id: number;
      readonly type: "private";
    }

    export interface Group {
      readonly all_members_are_administrators: boolean;
      readonly id: number;
      readonly title: string;
      readonly type: "group";
    }

    export interface SuperGroup {
      readonly id: number;
      readonly title: string;
      readonly type: "supergroup";
    }
  }

  export type Chat = Chat.Group | Chat.Private | Chat.SuperGroup;

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
    readonly file_id: string;
    readonly file_unique_id: string;
    readonly file_size: number;
    readonly file_path: string;
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
    readonly file_name: string;
    readonly file_unique_id: string;
    readonly file_size: number;
    readonly mime_type: string;
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

    export interface GroupChatCreated {
      readonly chat: Chat.Group;
      readonly date: number;
      readonly from: TelegramUser;
      readonly group_chat_created: boolean;
      readonly message_id: number;
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
      | Message.GroupChatCreated
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

  export interface MyChatMember {
    readonly my_chat_member: Readonly<{
      chat: Chat;
      from: TelegramUser;
      date: number;
      old_chat_member: TelegramChatMember;
      new_chat_member: TelegramChatMember;
    }>;
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
  | TelegramRawRequest.Message
  | TelegramRawRequest.Callback
  | TelegramRawRequest.MyChatMember
  | TelegramRawRequest.PreCheckout
  | TelegramRawRequest.SuccessfulPayment;

export namespace TelegramRawResponse {
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
    extends StrictOmit<TelegramGenericResponseOutput.Content.Invoice, "type"> {}

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
    parseMode?: TelegramRawResponse.ParseMode | undefined;
  } & (
    | {
        action: "answerPreCheckoutQuery";
        body: TelegramRawResponse.AnswerPreCheckoutQuery &
          Readonly<{ chat_id: string }>;
      }
    | {
        action: "sendDocument";
        body: TelegramRawResponse.SendDocument;
      }
    | {
        action: "sendInvoice";
        body: TelegramRawResponse.SendInvoice & Readonly<{ chat_id: string }>;
      }
    | {
        action: "sendMessage";
        body: TelegramRawResponse.SendMessage &
          Readonly<{
            chat_id: string;
            reply_markup?: TelegramRawResponse.ReplyMarkup | undefined;
          }>;
      }
    | {
        action: "sendPhoto";
        body: TelegramRawResponse.SendPhoto &
          Readonly<{
            chat_id: string;
            reply_markup?: TelegramRawResponse.ReplyMarkup | undefined;
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
      readonly TelegramClientSendResponseResult[]
    > {}

export type TelegramMessageProcessorMiddleware =
  MessageProcessorMiddleware<TelegramMessageProcessor>;

export type TelegramLeafObserver = ContentObserver<
  TelegramGenericRequest,
  NextResult
>;

export type TelegramLeaf = TelegramLeafObserver &
  ContentObservable<ContentObserver<TelegramGenericResponse, NextResult>>;

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

export namespace TelegramChatMember {
  export interface Owner {
    readonly custom_title: string | undefined;
    readonly is_anonymous: boolean;
    readonly status: "creator";
    readonly user: TelegramUser;
  }

  export interface Administrator {
    readonly can_be_edited: boolean;
    readonly can_change_info: boolean;
    readonly can_delete_messages: boolean;
    readonly can_edit_messages: boolean | undefined;
    readonly can_invite_users: boolean;
    readonly can_manage_chat: boolean;
    readonly can_manage_topics: boolean | undefined;
    readonly can_manage_video_chats: boolean;
    readonly can_pin_messages: boolean | undefined;
    readonly can_post_messages: boolean | undefined;
    readonly can_promote_members: boolean;
    readonly can_restrict_members: boolean;
    readonly custom_title: string | undefined;
    readonly is_anonymous: boolean;
    readonly status: "administrator";
    readonly user: TelegramUser;
  }

  export interface Member {
    readonly status: "member";
    readonly user: TelegramUser;
  }

  export interface Restricted {
    readonly can_add_web_page_previews: boolean;
    readonly can_change_info: boolean;
    readonly can_invite_users: boolean;
    readonly can_pin_messages: boolean;
    readonly can_manage_topics: boolean;
    readonly can_send_audios: boolean;
    readonly can_send_documents: boolean;
    readonly can_send_messages: boolean;
    readonly can_send_other_messages: boolean;
    readonly can_send_photos: boolean;
    readonly can_send_polls: boolean;
    readonly can_send_videos: boolean;
    readonly can_send_video_notes: boolean;
    readonly can_send_voice_notes: boolean;
    readonly is_member: boolean;
    readonly status: "restricted";
    readonly until_date: number;
    readonly user: TelegramUser;
  }

  export interface Left {
    readonly status: "left";
    readonly user: TelegramUser;
  }

  export interface Banned {
    readonly status: "kicked";
    readonly until_date: number;
    readonly user: TelegramUser;
  }
}

export type TelegramChatMember =
  | TelegramChatMember.Administrator
  | TelegramChatMember.Banned
  | TelegramChatMember.Left
  | TelegramChatMember.Member
  | TelegramChatMember.Owner
  | TelegramChatMember.Restricted;

/** Represents Telegram configurations */
export interface TelegramConfig {
  readonly authToken: string;
  readonly defaultParseMode?: TelegramRawResponse.ParseMode;
  readonly defaultPaymentProviderToken?: string;
}

export namespace TelegramRawResponse {
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
}

export namespace TelegramClientSendResponseResult {
  export type PreCheckoutConfirmation = true;
}

export type TelegramClientSendResponseResult =
  | TelegramRawRequest.Message["message"]
  | TelegramClientSendResponseResult.PreCheckoutConfirmation;

/** A Telegram-specific client */
export interface TelegramClient
  extends PlatformClientResponseSender<
      TelegramRawResponse,
      TelegramClientSendResponseResult
    >,
    PlatformClientTypingIndicatorSetter {
  deleteMessage(
    args: Readonly<{ chatID: number | string; messageID: number | string }>
  ): Promise<void>;

  /** Get the current chatbot */
  getCurrentBot(): Promise<TelegramBot>;

  /** Get a file using its ID */
  getFile(fileID: string): Promise<TelegramRawRequest.FileDetails>;

  /** Get the URL to a file in Telegram */
  getFileURL(filePath: string): Promise<string>;

  /** Convenience method to get a file's URL using its ID */
  getFileURLFromID(fileID: string): Promise<string>;

  /** Check if a bot is a member of a group */
  isMember(args: Readonly<{ chatID: string; botID: string }>): Promise<boolean>;

  /** Set webhook to start receiving message updates */
  setWebhook(webhookURL: string): Promise<unknown>;
}
