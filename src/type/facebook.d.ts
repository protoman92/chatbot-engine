import { DeepReadonly, Omit } from 'ts-essentials';
import { DefaultContext as RootDefaultContext } from './common';
import { PlatformCommunicator } from './communicator';
import { Leaf as RootLeaf } from './leaf';
import { Messenger as RootMessenger } from './messenger';
import { GenericRequest as RootGenericRequest } from './request';
import { GenericResponse as RootGenericResponse } from './response';
import { VisualContent as RootVisualContent } from './visual-content';

export namespace Facebook {
  namespace GenericRequest {
    interface Data extends RootGenericRequest.Data.Base {
      readonly targetPlatform: 'facebook';
      readonly stickerID: string;
    }
  }

  interface GenericRequest<C> extends RootGenericRequest.Base<C> {
    readonly targetPlatform: 'facebook';
    readonly data: readonly GenericRequest.Data[];
  }

  interface GenericResponse<C> extends RootGenericResponse.Base<C> {
    readonly targetPlatform: 'facebook';
    readonly visualContents: readonly VisualContent[];
  }

  namespace VisualContent {
    type QuickReply =
      | RootVisualContent.QuickReply.Location
      | RootVisualContent.QuickReply.Postback
      | RootVisualContent.QuickReply.Text;
  }

  interface VisualContent extends RootVisualContent.Base {
    readonly quickReplies?: readonly VisualContent.QuickReply[];
  }

  type DefaultContext = RootDefaultContext & GenericRequest.Data;

  namespace Leaf {
    type Observer<C> = RootLeaf.Base.Observer<C, DefaultContext>;
  }

  type Leaf<C> = RootLeaf.Base<C, DefaultContext>;

  namespace PlatformRequest {
    namespace Input {
      interface Base {
        readonly sender: Readonly<{ id: string }>;
        readonly recipient: Readonly<{ id: string }>;
        readonly timestamp: number;
      }

      interface Postback extends Base {
        readonly postback: Readonly<{ payload: string; title: string }>;
      }

      namespace Attachment {
        interface Image {
          readonly type: 'image';
          readonly payload: Readonly<{ url: string }>;
        }

        interface StickerImage extends Image {
          readonly sticker_id: number;
        }

        interface Location {
          readonly type: 'location';
          readonly title: string;
          readonly url: string;
          readonly payload: DeepReadonly<{
            coordinates: { lat: number; long: number };
          }>;
        }
      }

      interface BaseMessage extends Input.Base {
        readonly message: Readonly<{ mid: string; seq: number }>;
      }

      type Attachment =
        | Attachment.Image
        | Attachment.StickerImage
        | Attachment.Location;

      namespace Message {
        type Attachment = BaseMessage &
          DeepReadonly<{
            message: { attachments: readonly Input.Attachment[] };
          }>;

        type QuickReply = BaseMessage &
          DeepReadonly<{ quick_reply: { payload: string } }>;

        type Text = BaseMessage & DeepReadonly<{ message: { text: string } }>;
      }

      type Message = Message.Attachment | Message.Text | Message.QuickReply;
    }

    /** Represents possible combinations of Facebook requests. */
    type Input = Input.Message.Text | Input.Message.Attachment | Input.Postback;
  }

  /** Represents a webhook request. */
  interface PlatformRequest {
    readonly object: 'page';
    readonly entry:
      | Readonly<{ messaging: readonly PlatformRequest.Input[] }>[]
      | undefined
      | null;
  }

  namespace PlatformResponse {
    interface QuickReply {
      readonly title: string;
      readonly content_type: 'location' | 'text';
      readonly payload: string;
    }

    namespace SubContent {
      namespace Button {
        interface Base {
          readonly title: string;
        }

        interface Postback extends Base {
          readonly type: 'postback';
          readonly payload: string;
        }

        interface URL extends Base {
          readonly type: 'web_url';
          readonly url: string;
        }
      }

      type Button = Button.Postback | Button.URL;
    }

    namespace Content {
      interface Base {}

      type Button = Base &
        DeepReadonly<{
          messaging_type: 'RESPONSE';
          message: {
            attachment: {
              type: 'template';
              payload: {
                buttons: readonly SubContent.Button[];
                template_type: 'button';
                text: string;
              };
            };
          };
        }>;

      namespace Carousel {
        interface Element {
          readonly title: string;
          readonly subtitle: string | undefined;
          readonly image_url: string | undefined;
          readonly buttons: readonly SubContent.Button[] | undefined;
        }
      }

      type Carousel = Base &
        DeepReadonly<{
          messaging_type: 'RESPONSE';
          message: {
            attachment: {
              type: 'template';
              payload: {
                elements: readonly Carousel.Element[];
                template_type: 'generic';
              };
            };
          };
        }>;

      namespace List {
        interface Element {
          readonly title: string;
          readonly subtitle: string | undefined;
          readonly buttons: readonly SubContent.Button[] | undefined;
        }
      }

      type List = Base &
        DeepReadonly<{
          messaging_type: 'RESPONSE';
          message: {
            attachment: {
              payload: {
                buttons: readonly SubContent.Button[] | undefined;
                elements: readonly List.Element[];
                template_type: 'list';
                top_element_style: 'compact';
              };
              type: 'template';
            };
          };
        }>;

      type Media = Base &
        DeepReadonly<{
          message: {
            attachment: {
              type: 'image' | 'video';
              payload: { is_reusable: boolean; url: string };
            };
          };
        }>;

      type Text = Base &
        DeepReadonly<{ messaging_type: 'RESPONSE'; message: { text: string } }>;
    }

    type Output =
      | Content.Button
      | Content.Carousel
      | Content.List
      | Content.Media
      | Content.Text;
  }

  type PlatformResponse = Omit<PlatformResponse.Output, 'message'> &
    DeepReadonly<{
      recipient: { id: string };
      message: {
        quick_replies: readonly PlatformResponse.QuickReply[] | undefined;
      } & PlatformResponse.Output['message'];
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
        'hub.mode'?: string;
        'hub.challenge'?: number;
        'hub.verify_token'?: string;
      }>
    ): Promise<number>;
  }

  /**
   * Represents a Facebook-specific messenger.
   * @template C The context used by the current chatbot.
   */
  interface Messenger<C> extends RootMessenger<C, PlatformRequest> {}
}
