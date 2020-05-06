import { DeepReadonly, Omit } from "ts-essentials";
import { PlatformClient } from "./client";
import { Coordinates } from "./common";
import { LeafSelector } from "./leaf";
import { BaseMessageProcessor } from "./messenger";
import { BaseRequest } from "./request";
import { BaseResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";
import { BaseResponseOutput } from "./visual-content";

export type FacebookRequestInput = DeepReadonly<
  | {}
  | { inputCoordinate: Coordinates }
  | { inputText: string }
  | { inputImageURL: string }
  | { stickerID: string }
>;

export interface FacebookRequest<Context> extends BaseRequest<Context> {
  readonly targetPlatform: "facebook";
  readonly input: readonly FacebookRequestInput[];
}

export interface FacebookRequestPerInput<Context> extends BaseRequest<Context> {
  readonly targetPlatform: "facebook";
  readonly input: FacebookRequestInput;
}

export interface FacebookResponse<Context>
  extends BaseResponse<Context & FacebookDefaultContext> {
  readonly targetPlatform: "facebook";
  readonly output: readonly FacebookResponseOutput[];
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
        readonly url: string;
        readonly text: string;
        readonly type: "url";
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
      readonly actions: readonly Action[] | undefined | null;

      readonly items: Readonly<{
        title: string;
        description: string | undefined | null;
        mediaURL: string | undefined | null;
        actions: readonly Action[] | undefined | null;
      }>[];

      readonly type: "carousel";
    }

    interface List {
      readonly actions: readonly Action[] | undefined | null;

      readonly items: Readonly<{
        title: string;
        description: string | undefined | null;
        size: "large" | "small";
        actions: readonly Action[] | undefined | null;
      }>[];

      readonly type: "list";
    }

    namespace Media {
      interface Media {
        readonly type: "image" | "video";
        readonly url: string;
      }
    }

    interface Media {
      readonly media: Media.Media;
      readonly type: "media";
    }

    interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  type Content =
    | Content.Button
    | Content.Carousel
    | Content.List
    | Content.Media
    | Content.Text;
}

export interface FacebookResponseOutput extends BaseResponseOutput {
  readonly content: FacebookResponseOutput.Content;
  readonly quickReplies?: readonly FacebookResponseOutput.QuickReply[];
}

declare namespace FacebookRawRequest {
  namespace Entry {
    namespace Messaging {
      interface Postback {
        readonly postback: Readonly<{ payload: string; title: string }>;
        readonly sender: Readonly<{ id: string }>;
        readonly recipient: Readonly<{ id: string }>;
        readonly timestamp: number;
      }

      namespace Message {
        namespace Attachment {
          namespace Attachment {
            interface Image {
              readonly type: "image";
              readonly payload: Readonly<{ url: string }>;
            }

            interface StickerImage extends Image {
              readonly sticker_id: number;
            }

            interface Location {
              readonly type: "location";
              readonly title: string;
              readonly url: string;
              readonly payload: DeepReadonly<{
                coordinates: { lat: number; long: number };
              }>;
            }
          }

          type Attachment =
            | Attachment.Image
            | Attachment.StickerImage
            | Attachment.Location;
        }

        interface Attachment {
          readonly message: Readonly<{
            attachments: readonly Attachment.Attachment[];
            message: Readonly<{ mid: string; seq: number }>;
          }>;

          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }

        interface QuickReply {
          readonly quick_reply: Readonly<{ payload: string }>;
          readonly message: Readonly<{ mid: string; seq: number }>;
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
    }

    /** Represents possible combinations of Facebook requests */
    type Messaging = Messaging.Message | Messaging.Postback;
  }
}

/** Represents a webhook request */
export interface FacebookRawRequest {
  readonly object: "page";
  readonly entry:
    | Readonly<{
        messaging: readonly FacebookRawRequest.Entry.Messaging[];
      }>[]
    | undefined
    | null;
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
      readonly message: DeepReadonly<{
        attachment: {
          type: "template";
          payload: {
            buttons: readonly Button.Button[];
            template_type: "button";
            text: string;
          };
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
      readonly message: DeepReadonly<{
        attachment: {
          type: "template";
          payload: {
            elements: readonly Carousel.Element[];
            template_type: "generic";
          };
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
      readonly message: DeepReadonly<{
        attachment: {
          payload: {
            buttons: readonly Button.Button[] | undefined;
            elements: readonly List.Element[];
            template_type: "list";
            top_element_style: "compact";
          };
          type: "template";
        };
      }>;
    }

    interface Media {
      readonly message: DeepReadonly<{
        attachment: {
          type: "image" | "video";
          payload: { is_reusable: boolean; url: string };
        };
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
  DeepReadonly<{
    recipient: { id: string };
    message: {
      quick_replies: readonly FacebookRawResponse.QuickReply[] | undefined;
    } & FacebookRawResponse.Message["message"];
  }>;

declare namespace FacebookMessageProcessor {
  interface Configs<Context> {
    readonly leafSelector: LeafSelector<Context>;
    readonly client: FacebookClient;
  }
}

/** Represents a Facebook-specific messenger */
export interface FacebookMessageProcessor<Context>
  extends BaseMessageProcessor<
    Context,
    FacebookRawRequest,
    FacebookRequest<Context>
  > {}

export type FacebookDefaultContext = {};

export type FacebookLeafObserver<T> = ContentObserver<
  FacebookRequestPerInput<T & FacebookDefaultContext>
>;

export type FacebookLeaf<T> = FacebookLeafObserver<T> &
  ContentObservable<FacebookResponse<T>>;

/** Represents a Facebook user */
export interface FacebookUser {
  readonly first_name?: string;
  readonly last_name?: string;
  readonly profile_pic?: string;
  readonly id: string;
}

/** Represents Facebook configurations */
export interface FacebookConfigs {
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
