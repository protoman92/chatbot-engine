import { AppendOptions } from "form-data";
import { ReadStream } from "fs";
import { GenericManualTriggerRequest } from ".";
import { PlatformClient } from "./client";
import { Coordinates } from "./common";
import { LeafSelector } from "./leaf";
import {
  GenericRequestReceiver,
  GenericResponseSender,
  MessageProcessorMiddleware,
  RawRequestGeneralizer,
} from "./messenger";
import {
  BaseRequest,
  CrossPlatformRequestInput,
  GenericMessageTriggerRequest,
} from "./request";
import { BaseGenericResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";
import { BaseGenericResponseOutput } from "./visual-content";

export type FacebookRequestInput =
  | Readonly<{ param: string; type: "deeplink" }>
  | Readonly<{ payload: string; type: "postback" }>
  | Readonly<{ coordinate: Coordinates; type: "location" }>
  | Readonly<{ image: string; type: "image" }>
  | Readonly<{ image: string; stickerID: string; type: "sticker" }>
  | CrossPlatformRequestInput;

export type FacebookGenericRequest = Readonly<{
  targetPlatform: "facebook";
}> &
  BaseRequest &
  (
    | (GenericMessageTriggerRequest<FacebookRawRequest> &
        Readonly<{ input: FacebookRequestInput }>)
    | (GenericManualTriggerRequest & Readonly<{ input: FacebookRequestInput }>)
  );

export interface FacebookGenericResponse extends BaseGenericResponse {
  readonly output: readonly FacebookGenericResponseOutput[];
  readonly targetPlatform: "facebook";
}

export namespace _FacebookGenericResponseOutput {
  export namespace QuickReply {
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
  }

  export type QuickReply =
    | QuickReply.Location
    | QuickReply.Postback
    | QuickReply.Text;

  export namespace Action {
    export interface Postback {
      readonly payload: string;
      readonly text: string;
      readonly type: "postback";
    }

    export interface URL {
      readonly text: string;
      readonly type: "url";
      readonly url: string;
    }
  }

  /** Does something, like communicating with a remote service */
  export type Action = Action.Postback | Action.URL;

  export namespace Content {
    export interface Button {
      readonly actions: readonly Action[];
      readonly text: string;
      readonly type: "button";
    }

    export interface Carousel {
      readonly actions?: readonly Action[];
      readonly items: readonly Readonly<{
        title: string;
        description?: string;
        image?: string;
        actions?: readonly Action[];
      }>[];
      readonly type: "carousel";
    }

    export namespace FileAttachment {
      export interface Ambiguous {
        readonly attachmentIDOrURL: string;
        readonly attachmentType: _FacebookRawResponse.FileAttachmentType;
        readonly type: "attachment";
      }

      export interface ByID {
        readonly attachmentID: string;
        readonly attachmentType: _FacebookRawResponse.FileAttachmentType;
        readonly type: "attachment";
      }

      export interface ByURL {
        readonly attachmentType: _FacebookRawResponse.FileAttachmentType;
        readonly reusable?: boolean;
        readonly type: "attachment";
        readonly url: string;
      }
    }

    export type FileAttachment =
      | FileAttachment.Ambiguous
      | FileAttachment.ByID
      | FileAttachment.ByURL;

    export namespace Media {
      export interface Image {
        readonly actions: readonly Action[];
        readonly image: string;
        readonly type: "media";
      }

      export interface Video {
        readonly actions: readonly Action[];
        readonly type: "media";
        readonly video: string;
      }
    }

    export type Media = Media.Image | Media.Video;

    export interface List {
      readonly actions?: readonly Action[];
      readonly items: Readonly<{
        title: string;
        description?: string;
        size: "large" | "small";
        actions?: readonly Action[];
      }>[];
      readonly type: "list";
    }

    export interface Text {
      readonly text: string;
      readonly type: "text";
    }
  }

  export type Content = (
    | Content.Button
    | Content.Carousel
    | Content.FileAttachment
    | Content.List
    | Content.Media
    | Content.Text
  ) &
    Readonly<{ tag?: _FacebookRawResponse.MessageTag }>;

  export interface Menu {
    readonly actions: readonly [Action, ...Action[]];
    readonly type: "menu";
  }
}

export type FacebookGenericResponseOutput = BaseGenericResponseOutput &
  Readonly<
    | {
        content: _FacebookGenericResponseOutput.Content;
        quickReplies?: readonly _FacebookGenericResponseOutput.QuickReply[];
      }
    | {
        content: _FacebookGenericResponseOutput.Menu;
        quickReplies?: never[];
        tag?: never;
      }
  >;

export namespace _FacebookRawRequest {
  export namespace Attachment {
    export interface Image {
      readonly type: "image";
      readonly payload: Readonly<{ url: string }> &
        ({} | Readonly<{ sticker_id: number }>);
    }

    export interface Location {
      readonly type: "location";
      readonly title: string;
      readonly url: string;
      readonly payload: Readonly<{
        coordinates: Readonly<{ lat: number; long: number }>;
      }>;
    }
  }

  export type Attachment = Attachment.Image | Attachment.Location;

  export namespace Entry {
    export namespace Messaging {
      export interface Postback {
        readonly postback: Readonly<{ payload: string; title: string }>;
        readonly sender: Readonly<{ id: string }>;
        readonly recipient: Readonly<{ id: string }>;
        readonly timestamp: number;
      }

      export namespace Message {
        export interface Attachment {
          readonly message: Readonly<{
            attachments: readonly _FacebookRawRequest.Attachment[];
            message: Readonly<{ mid: string; seq: number }>;
          }>;
          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }

        export interface QuickReply {
          readonly message: Readonly<{
            mid: string;
            quick_reply: Readonly<{ payload: string }>;
            seq: number;
          }>;
          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }

        export interface Text {
          readonly message: Readonly<{
            text: string;
            message: Readonly<{ mid: string; seq: number }>;
          }>;
          readonly sender: Readonly<{ id: string }>;
          readonly recipient: Readonly<{ id: string }>;
          readonly timestamp: number;
        }
      }

      export type Message =
        | Message.Attachment
        | Message.Text
        | Message.QuickReply;

      export interface Referral {
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
    export type Messaging =
      | Messaging.Message
      | Messaging.Postback
      | Messaging.Referral;
  }
}

/** Represents a webhook request */
export interface FacebookRawRequest {
  readonly object: "page";
  readonly entry: Readonly<{
    messaging: readonly _FacebookRawRequest.Entry.Messaging[];
  }>[];
}

export namespace _FacebookRawResponse {
  export namespace Button {
    export interface Postback {
      readonly payload: string;
      readonly title: string;
      readonly type: "postback";
    }

    export interface URL {
      readonly title: string;
      readonly type: "web_url";
      readonly url: string;
    }
  }

  export type Button = Button.Postback | Button.URL;
  export type FileAttachmentType = "file" | "image" | "video";

  export interface Menu {
    readonly persistent_menu: readonly Readonly<{
      call_to_actions: readonly _FacebookRawResponse.Button[];
      composer_input_disabled: boolean;
      locale: string;
    }>[];
    readonly psid: FacebookUser["id"];
  }

  export type MessageTag =
    | "ACCOUNT_UPDATE"
    | "CONFIRMED_EVENT_UPDATE"
    | "HUMAN_AGENT"
    | "POST_PURCHASE_UPDATE";

  export interface QuickReply {
    readonly title: string;
    readonly content_type: "location" | "text";
    readonly payload: string;
  }

  export namespace Message {
    export interface Attachment {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: _FacebookRawResponse.FileAttachmentType;
          payload: Readonly<
            { attachment_id: string } | { is_reusable: boolean; url: string }
          >;
        }>;
      }>;
    }

    export interface Button {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: "template";
          payload: Readonly<{
            buttons: readonly _FacebookRawResponse.Button[];
            template_type: "button";
            text: string;
          }>;
        }>;
      }>;
    }

    export interface Carousel {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: "template";
          payload: Readonly<{
            elements: readonly Readonly<{
              title: string;
              subtitle?: string;
              image_url?: string;
              buttons?: readonly _FacebookRawResponse.Button[];
            }>[];
            template_type: "generic";
          }>;
        }>;
      }>;
    }

    export interface List {
      readonly message: Readonly<{
        attachment: Readonly<{
          payload: Readonly<{
            buttons?: readonly _FacebookRawResponse.Button[];
            elements: readonly Readonly<{
              buttons?: readonly _FacebookRawResponse.Button[];
              title: string;
              subtitle?: string | undefined;
            }>[];
            template_type: "list";
            top_element_style: "compact";
          }>;
          type: "template";
        }>;
      }>;
    }

    export interface RichMedia {
      readonly message: Readonly<{
        attachment: Readonly<{
          type: "template";
          payload: Readonly<{
            elements: [
              Readonly<
                {
                  buttons?: readonly _FacebookRawResponse.Button[];
                  media_type: "image" | "video";
                } & ({ attachment_id: string } | { url: string })
              >
            ];
            template_type: "media";
          }>;
        }>;
      }>;
    }

    export interface Text {
      readonly message: Readonly<{ text: string }>;
    }
  }

  export type Message =
    | Message.Attachment
    | Message.Button
    | Message.Carousel
    | Message.List
    | Message.RichMedia
    | Message.Text;
}

export type FacebookRawResponse = Readonly<
  { recipient: Readonly<{ id: string }> } & (
    | {
        messaging_type: "MESSAGE_TAG";
        tag: _FacebookRawResponse.MessageTag;
      }
    | { messaging_type: "RESPONSE" }
  ) &
    (Omit<_FacebookRawResponse.Message, "message"> & {
      message: {
        quick_replies?: readonly _FacebookRawResponse.QuickReply[];
      } & _FacebookRawResponse.Message["message"];
    })
>;

export interface FacebookMessageProcessorConfig {
  readonly leafSelector: LeafSelector;
  readonly client: FacebookClient;
}

/** Represents a Facebook-specific messenger */
export interface FacebookMessageProcessor
  extends RawRequestGeneralizer<FacebookRawRequest, FacebookGenericRequest>,
    GenericRequestReceiver<FacebookGenericRequest>,
    GenericResponseSender<FacebookGenericResponse, unknown> {}

export type FacebookMessageProcessorMiddleware = MessageProcessorMiddleware<
  FacebookMessageProcessor
>;

export type FacebookLeafObserver = ContentObserver<FacebookGenericRequest>;

export type FacebookLeaf = FacebookLeafObserver &
  ContentObservable<FacebookGenericResponse>;

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
  sendMenuSettings(menu: _FacebookRawResponse.Menu): Promise<unknown>;

  /** Upload an attachment and get Facebook's attachment ID */
  uploadAttachment(
    attachment: Readonly<
      {
        reusable: boolean;
        type: _FacebookRawResponse.FileAttachmentType;
      } & ({ fileData: Buffer | ReadStream } | { url: string })
    > &
      AppendOptions
  ): Promise<Readonly<{ attachmentID: string }>>;
}
