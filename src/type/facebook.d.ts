import { DeepReadonly, Omit } from "ts-essentials";
import { DefaultContext as RootDefaultContext } from "./common";
import { PlatformCommunicator } from "./communicator";
import { Leaf as RootLeaf } from "./leaf";
import { Messenger as RootMessenger } from "./messenger";
import { RootGenericRequest, RootGenericRequestInput } from "./request";
import { RootGenericResponse } from "./response";
import { VisualContent as RootVisualContent } from "./visual-content";

export interface GenericFacebookRequestInput extends RootGenericRequestInput {
  readonly targetPlatform: "facebook";
  readonly stickerID: string;
}

export interface GenericFacebookRequest<C> extends RootGenericRequest<C> {
  readonly targetPlatform: "facebook";
  readonly input: readonly GenericFacebookRequestInput[];
}

export interface GenericFacebookResponse<C> extends RootGenericResponse<C> {
  readonly targetPlatform: "facebook";
  readonly output: readonly Facebook.VisualContent[];
}

export namespace Facebook {
  namespace VisualContent {
    type QuickReply =
      | RootVisualContent.QuickReply.Location
      | RootVisualContent.QuickReply.Postback
      | RootVisualContent.QuickReply.Text;
  }

  interface VisualContent extends RootVisualContent.Base {
    readonly quickReplies?: readonly VisualContent.QuickReply[];
  }

  type DefaultContext = RootDefaultContext & GenericFacebookRequestInput;

  namespace Leaf {
    type Observer<C> = RootLeaf.Base.Observer<C, DefaultContext>;
  }

  type Leaf<C> = RootLeaf.Base<C, DefaultContext>;

  namespace PlatformRequest {
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

      /** Represents possible combinations of Facebook requests. */
      type Messaging = Messaging.Message | Messaging.Postback;
    }
  }

  /** Represents a webhook request. */
  interface PlatformRequest {
    readonly object: "page";
    readonly entry:
      | Readonly<{ messaging: readonly PlatformRequest.Entry.Messaging[] }>[]
      | undefined
      | null;
  }

  namespace PlatformResponse {
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

  type PlatformResponse = Omit<PlatformResponse.Message, "message"> &
    DeepReadonly<{
      recipient: { id: string };
      message: {
        quick_replies: readonly PlatformResponse.QuickReply[] | undefined;
      } & PlatformResponse.Message["message"];
    }>;

  /** Represents a Facebook user. */
  interface User {
    readonly first_name?: string;
    readonly last_name?: string;
    readonly profile_pic?: string;
    readonly id: string;
  }

  /** Represents Facebook configurations. */
  interface Configs {
    readonly apiVersion: string;
    readonly pageToken: string;
    readonly verifyToken: string;
  }

  /** Represents a Facebook-specific communicator. */
  interface Communicator extends PlatformCommunicator<PlatformResponse> {
    /** Get the user associated with a sender ID. */
    getUser(targetID: string): Promise<User>;

    /** Resolve Facebook hub challenge to establish connection with chatbot. */
    resolveVerifyChallenge(
      requestQuery: Readonly<{
        "hub.mode"?: string;
        "hub.challenge"?: number;
        "hub.verify_token"?: string;
      }>
    ): Promise<number>;
  }

  /**
   * Represents a Facebook-specific messenger.
   * @template C The context used by the current chatbot.
   */
  interface Messenger<C>
    extends RootMessenger<C, PlatformRequest, GenericFacebookRequest<C>> {}
}
