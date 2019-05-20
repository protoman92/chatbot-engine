import { DeepReadonly } from 'ts-essentials';
import { PlatformCommunicator } from './communicator';
import { UnitMessenger } from './messenger';

declare namespace FacebookRequest {
  interface BaseInput {
    readonly sender: Readonly<{ id: string }>;
    readonly recipient: Readonly<{ id: string }>;
    readonly timestamp: number;
  }

  namespace Input {
    interface Postback extends BaseInput {
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

    interface BaseMessage extends BaseInput {
      readonly message: Readonly<{ mid: string; seq: number }>;
    }

    type Attachment =
      | Attachment.Image
      | Attachment.StickerImage
      | Attachment.Location;

    namespace Message {
      type Attachment = BaseMessage &
        DeepReadonly<{ message: { attachments: Input.Attachment[] } }>;

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
export interface FacebookRequest {
  readonly object: 'page';
  readonly entry:
    | Readonly<{ messaging: readonly FacebookRequest.Input[] }>[]
    | undefined
    | null;
}

/** Represents a Facebook user. */
export interface FacebookUser {
  readonly first_name?: string;
  readonly last_name?: string;
  readonly profile_pic?: string;
  readonly id: string;
}

/** Represents Facebook configurations. */
export interface FacebookConfigs {
  readonly apiVersion: string;
  readonly pageToken: string;
  readonly verifyToken: string;
}

/** Represents a Facebook-specific communicator. */
export interface FacebookCommunicator extends PlatformCommunicator {}

/**
 * Represents a Facebook-specific unit messenger.
 * @template C The context used by the current chatbot.
 */
export interface FacebookUnitMessenger<C> extends UnitMessenger<C> {
  /**
   * Resolve Facebook hub challenge to establish connection with chatbot.
   * @param requestQuery The query parameters of the request.
   * @return The hub challenge code.
   */
  resolveVerifyChallenge(
    requestQuery: Readonly<{
      'hub.mode'?: string;
      'hub.challenge'?: number;
      'hub.verify_token'?: string;
    }>
  ): Promise<number>;
}
