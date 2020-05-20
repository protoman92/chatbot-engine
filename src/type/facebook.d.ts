import { Omit } from "ts-essentials";
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
  | Readonly<{ coordinate: Coordinates; type: "location" }>
  | Readonly<{ image: string; type: "image" }>
  | Readonly<{
      image: string;
      stickerID: string;
      type: "sticker";
    }>
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
  namespace Content {
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

    interface Button {
      readonly actions: readonly Action[];
      readonly text: string;
      readonly type: "button";
    }

    interface Carousel {
      readonly actions?: readonly Action[];
      readonly items: Readonly<{
        title: string;
        description?: string;
        image?: string;
        actions?: readonly Action[];
      }>[];
      readonly type: "carousel";
    }

    interface Image {
      readonly image: string;
      readonly type: "image";
    }

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

    interface Video {
      readonly type: "video";
      readonly video: string;
    }
  }

  type Content =
    | Content.Button
    | Content.Carousel
    | Content.Image
    | Content.List
    | Content.Text
    | Content.Video;
}

export interface FacebookResponseOutput extends BaseResponseOutput {
  readonly content: FacebookResponseOutput.Content;
  readonly quickReplies?: readonly FacebookResponseOutput.QuickReply[];
}

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
  interface QuickReply {
    readonly title: string;
    readonly content_type: "location" | "text";
    readonly payload: string;
  }

  namespace Message {
    namespace Button {
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
    }

    interface Button {
      readonly messaging_type: "RESPONSE";
      readonly message: Readonly<{
        attachment: {
          type: "template";
          payload: Readonly<{
            buttons: readonly Button.Button[];
            template_type: "button";
            text: string;
          }>;
        };
      }>;
    }

    namespace Carousel {
      interface Element {
        readonly title: string;
        readonly subtitle: string | undefined;
        readonly image_url: string | undefined;
        readonly buttons: readonly Button.Button[] | undefined;
      }
    }

    interface Carousel {
      readonly messaging_type: "RESPONSE";
      readonly message: Readonly<{
        attachment: {
          type: "template";
          payload: Readonly<{
            elements: readonly Carousel.Element[];
            template_type: "generic";
          }>;
        };
      }>;
    }

    namespace List {
      interface Element {
        readonly title: string;
        readonly subtitle: string | undefined;
        readonly buttons: readonly Button.Button[] | undefined;
      }
    }

    interface List {
      readonly messaging_type: "RESPONSE";
      readonly message: Readonly<{
        attachment: {
          payload: Readonly<{
            buttons: readonly Button.Button[] | undefined;
            elements: readonly List.Element[];
            template_type: "list";
            top_element_style: "compact";
          }>;
          type: "template";
        };
      }>;
    }

    interface Media {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: "image" | "video";
          payload: Readonly<{ is_reusable: boolean; url: string }>;
        }>;
      }>;
    }

    interface Text {
      readonly messaging_type: "RESPONSE";
      readonly message: Readonly<{ text: string }>;
    }
  }

  type Message =
    | Message.Button
    | Message.Carousel
    | Message.List
    | Message.Media
    | Message.Text;
}

export type FacebookRawResponse = Omit<FacebookRawResponse.Message, "message"> &
  Readonly<{
    recipient: Readonly<{ id: string }>;
    message: {
      quick_replies: readonly FacebookRawResponse.QuickReply[] | undefined;
    } & FacebookRawResponse.Message["message"];
  }>;

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
}
