import { AppendOptions } from "form-data";
import { ReadStream } from "fs";
import { PlatformClient } from "./client";
import { Coordinates } from "./common";
import { LeafSelector } from "./leaf";
import { BaseMessageProcessor } from "./messenger";
import { BaseRequest, CrossPlatformRequestInput } from "./request";
import { BaseResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";
import { BaseResponseOutput } from "./visual-content";

export type FacebookRequestInput<Context> =
  | Readonly<{ param: string; type: "deeplink" }>
  | Readonly<{ payload: string; type: "postback" }>
  | Readonly<{ coordinate: Coordinates; type: "location" }>
  | Readonly<{ image: string; type: "image" }>
  | Readonly<{ image: string; stickerID: string; type: "sticker" }>
  | CrossPlatformRequestInput<Context>;

type CommonFacebookRequest<Context> = Readonly<{ targetPlatform: "facebook" }> &
  BaseRequest<Context>;

export type FacebookRequest<Context> = CommonFacebookRequest<Context> &
  (
    | Readonly<{
        input: FacebookRequestInput<Context>;
        type: "message_trigger";
      }>
    | Readonly<{ input: FacebookRequestInput<Context>; type: "manual_trigger" }>
  );

export interface FacebookResponse<Context>
  extends BaseResponse<Context & FacebookDefaultContext> {
  readonly output: readonly FacebookResponseOutput[];
  readonly targetPlatform: "facebook";
}

declare namespace FacebookResponseOutput {
  namespace QuickReply {
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
  }

  type QuickReply = QuickReply.Location | QuickReply.Postback | QuickReply.Text;
}

declare namespace FacebookResponseOutput {
  namespace Action {
    interface Postback {
      readonly payload: string;
      readonly text: string;
      readonly type: "postback";
    }

    interface URL {
      readonly text: string;
      readonly type: "url";
      readonly url: string;
    }
  }

  /** Does something, like communicating with a remote service */
  type Action = Action.Postback | Action.URL;

  namespace Content {
    interface Button {
      readonly actions: readonly Action[];
      readonly text: string;
      readonly type: "button";
    }

    interface Carousel {
      readonly actions?: readonly Action[];
      readonly items: readonly Readonly<{
        title: string;
        description?: string;
        image?: string;
        actions?: readonly Action[];
      }>[];
      readonly type: "carousel";
    }

    namespace FileAttachment {
      interface Ambiguous {
        readonly attachmentIDOrURL: string;
        readonly attachmentType: FacebookRawResponse.FileAttachmentType;
        readonly type: "attachment";
      }

      interface ByID {
        readonly attachmentID: string;
        readonly attachmentType: FacebookRawResponse.FileAttachmentType;
        readonly type: "attachment";
      }

      interface ByURL {
        readonly attachmentType: FacebookRawResponse.FileAttachmentType;
        readonly reusable?: boolean;
        readonly type: "attachment";
        readonly url: string;
      }
    }

    type FileAttachment =
      | FileAttachment.Ambiguous
      | FileAttachment.ByID
      | FileAttachment.ByURL;

    namespace Media {
      interface Image {
        actions: readonly Action[];
        image: string;
        type: "media";
      }

      interface Video {
        actions: readonly Action[];
        type: "media";
        video: string;
      }
    }

    type Media = Media.Image | Media.Video;

    interface List {
      readonly actions?: readonly Action[];
      readonly items: Readonly<{
        title: string;
        description?: string;
        size: "large" | "small";
        actions?: readonly Action[];
      }>[];
      readonly type: "list";
    }

    interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  type Content = (
    | Content.Button
    | Content.Carousel
    | Content.FileAttachment
    | Content.List
    | Content.Media
    | Content.Text
  ) &
    Readonly<{ tag?: FacebookRawResponse.MessageTag }>;

  interface Menu {
    readonly actions: readonly [Action, ...Action[]];
    readonly type: "menu";
  }
}

export type FacebookResponseOutput = BaseResponseOutput &
  (
    | Readonly<{
        content: FacebookResponseOutput.Content;
        quickReplies?: readonly FacebookResponseOutput.QuickReply[];
      }>
    | Readonly<{
        content: FacebookResponseOutput.Menu;
        quickReplies?: never[];
        tag?: never;
      }>
  );

declare namespace FacebookRawRequest {
  namespace Attachment {
    interface Image {
      readonly type: "image";
      readonly payload: Readonly<{ url: string }> &
        ({} | Readonly<{ sticker_id: number }>);
    }

    interface Location {
      readonly type: "location";
      readonly title: string;
      readonly url: string;
      readonly payload: Readonly<{
        coordinates: Readonly<{ lat: number; long: number }>;
      }>;
    }
  }

  type Attachment = Attachment.Image | Attachment.Location;

  namespace Entry {
    namespace Messaging {
      interface Postback {
        readonly postback: Readonly<{ payload: string; title: string }>;
        readonly sender: Readonly<{ id: string }>;
        readonly recipient: Readonly<{ id: string }>;
        readonly timestamp: number;
      }

      namespace Message {
        interface Attachment {
          readonly message: Readonly<{
            attachments: readonly FacebookRawRequest.Attachment[];
            message: Readonly<{ mid: string; seq: number }>;
          }>;
          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }

        interface QuickReply {
          readonly message: Readonly<{
            mid: string;
            quick_reply: Readonly<{ payload: string }>;
            seq: number;
          }>;
          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }

        interface Text {
          readonly message: Readonly<{
            text: string;
            message: Readonly<{ mid: string; seq: number }>;
          }>;
          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }
      }

      type Message = Message.Attachment | Message.Text | Message.QuickReply;

      interface Referral {
        readonly recipient: Readonly<{ id: string }>;
        readonly referral: Readonly<{
          ref: string;
          source: "SHORTLINK";
          type: "OPEN_THREAD";
        }>;
        readonly sender: Readonly<{ id: string }>;
      }
    }

    /** Represents possible combinations of Facebook requests */
    type Messaging =
      | Messaging.Message
      | Messaging.Postback
      | Messaging.Referral;
  }
}

/** Represents a webhook request */
export interface FacebookRawRequest {
  readonly object: "page";
  readonly entry?: Readonly<{
    messaging: readonly FacebookRawRequest.Entry.Messaging[];
  }>[];
}

declare namespace FacebookRawResponse {
  namespace Button {
    interface Postback {
      readonly payload: string;
      readonly title: string;
      readonly type: "postback";
    }

    interface URL {
      readonly title: string;
      readonly type: "web_url";
      readonly url: string;
    }
  }

  type Button = Button.Postback | Button.URL;
  type FileAttachmentType = "file" | "image" | "video";

  interface Menu {
    readonly persistent_menu: readonly Readonly<{
      call_to_actions: readonly FacebookRawResponse.Button[];
      composer_input_disabled: boolean;
      locale: string;
    }>[];
    readonly psid: FacebookUser["id"];
  }

  type MessageTag =
    | "ACCOUNT_UPDATE"
    | "CONFIRMED_EVENT_UPDATE"
    | "HUMAN_AGENT"
    | "POST_PURCHASE_UPDATE";

  interface QuickReply {
    readonly title: string;
    readonly content_type: "location" | "text";
    readonly payload: string;
  }

  namespace Message {
    interface Attachment {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: FacebookRawResponse.FileAttachmentType;
          payload: Readonly<
            { attachment_id: string } | { is_reusable: boolean; url: string }
          >;
        }>;
      }>;
    }

    interface Button {
      readonly message: Readonly<{
        attachment: {
          type: "template";
          payload: Readonly<{
            buttons: readonly FacebookRawResponse.Button[];
            template_type: "button";
            text: string;
          }>;
        };
      }>;
    }

    interface Carousel {
      readonly message: Readonly<{
        attachment: {
          type: "template";
          payload: Readonly<{
            elements: readonly Readonly<{
              title: string;
              subtitle?: string;
              image_url?: string;
              buttons?: readonly FacebookRawResponse.Button[];
            }>[];
            template_type: "generic";
          }>;
        };
      }>;
    }

    interface List {
      readonly message: Readonly<{
        attachment: {
          payload: Readonly<{
            buttons?: readonly FacebookRawResponse.Button[];
            elements: readonly Readonly<{
              buttons?: readonly FacebookRawResponse.Button[];
              title: string;
              subtitle?: string | undefined;
            }>[];
            template_type: "list";
            top_element_style: "compact";
          }>;
          type: "template";
        };
      }>;
    }

    interface RichMedia {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: "template";
          payload: Readonly<{
            elements: [
              Readonly<
                {
                  buttons?: readonly FacebookRawResponse.Button[];
                  media_type: "image" | "video";
                } & ({ attachment_id: string } | { url: string })
              >
            ];
            template_type: "media";
          }>;
        }>;
      }>;
    }

    interface Text {
      readonly message: Readonly<{ text: string }>;
    }
  }

  type Message =
    | Message.Attachment
    | Message.Button
    | Message.Carousel
    | Message.List
    | Message.RichMedia
    | Message.Text;
}

export type FacebookRawResponse = Readonly<{
  recipient: Readonly<{ id: string }>;
}> &
  (
    | Readonly<{
        messaging_type: "MESSAGE_TAG";
        tag: FacebookRawResponse.MessageTag;
      }>
    | Readonly<{ messaging_type: "RESPONSE" }>
  ) &
  (Omit<FacebookRawResponse.Message, "message"> &
    Readonly<{
      message: {
        quick_replies?: readonly FacebookRawResponse.QuickReply[];
      } & FacebookRawResponse.Message["message"];
    }>);

export interface FacebookMessageProcessorConfig<Context> {
  readonly leafSelector: LeafSelector<Context>;
  readonly client: FacebookClient;
}

/** Represents a Facebook-specific messenger */
export interface FacebookMessageProcessor<Context>
  extends BaseMessageProcessor<Context> {}

export type FacebookDefaultContext = {};

export type FacebookLeafObserver<T> = ContentObserver<
  FacebookRequest<T & FacebookDefaultContext>
>;

export type FacebookLeaf<T> = FacebookLeafObserver<T> &
  ContentObservable<FacebookResponse<T>>;

/** Represents a Facebook user */
export interface FacebookUser {
  readonly first_name?: string;
  readonly last_name?: string;
  readonly profile_pic?: string;
  readonly id: number | string;
}

/** Represents Facebook configurations */
export interface FacebookConfig {
  readonly apiVersion: string;
  readonly pageToken: string;
  readonly verifyToken: string;
}

/** Represents a Facebook-specific client */
export interface FacebookClient extends PlatformClient<FacebookRawResponse> {
  /** Get the user associated with a sender ID */
  getUser(targetID: string): Promise<FacebookUser>;

  /** Resolve Facebook hub challenge to establish connection with chatbot */
  resolveVerifyChallenge(
    requestQuery: Readonly<{
      "hub.mode"?: string;
      "hub.challenge"?: number;
      "hub.verify_token"?: string;
    }>
  ): Promise<number>;

  /** Send request to set up user's custom menu */
  sendMenuSettings(menu: FacebookRawResponse.Menu): Promise<unknown>;

  /** Upload an attachment and get Facebook's attachment ID */
  uploadAttachment(
    attachment: Readonly<{
      reusable: boolean;
      type: FacebookRawResponse.FileAttachmentType;
    }> &
      (
        | Readonly<{ fileData: Buffer | ReadStream }>
        | Readonly<{ url: string }>
      ) &
      AppendOptions
  ): Promise<Readonly<{ attachmentID: string }>>;
}
