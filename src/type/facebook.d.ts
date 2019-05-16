import { DeepReadonly } from 'ts-essentials';
import { FacebookResponse } from './facebook-visual-content';
import { UnitMessenger } from './messenger';

interface BaseFacebookRequest {
  readonly sender: Readonly<{ id: string }>;
  readonly recipient: Readonly<{ id: string }>;
  readonly timestamp: number;
}

declare namespace FacebookRequest {
  export interface Postback extends BaseFacebookRequest {
    readonly postback: Readonly<{ payload: string; title: string }>;
  }

  namespace Attachment {
    export interface Image {
      readonly type: 'image';
      readonly payload: Readonly<{ url: string }>;
    }

    export interface StickerImage extends Image {
      readonly sticker_id: number;
    }

    export interface Location {
      readonly type: 'location';
      readonly title: string;
      readonly url: string;
      readonly payload: DeepReadonly<{
        coordinates: { lat: number; long: number };
      }>;
    }
  }

  interface BaseMessage extends BaseFacebookRequest {
    readonly message: Readonly<{ mid: string; seq: number }>;
  }

  export type Attachment =
    | Attachment.Image
    | Attachment.StickerImage
    | Attachment.Location;

  namespace Message {
    export type Attachment = BaseMessage &
      DeepReadonly<{ message: { attachments: FacebookRequest.Attachment[] } }>;

    export type QuickReply = BaseMessage &
      DeepReadonly<{ quick_reply: { payload: string } }>;

    export type Text = BaseMessage &
      DeepReadonly<{ message: { text: string } }>;
  }

  export type Message = Message.Attachment | Message.Text | Message.QuickReply;
}

/** Represents possible combinations of Facebook requests. */
export type FacebookRequest =
  | FacebookRequest.Message.Text
  | FacebookRequest.Message.Attachment
  | FacebookRequest.Postback;

/** Represents a webhook request. */
export interface FacebookWebhookRequest {
  readonly object: 'page';
  readonly entry:
    | Readonly<{ messaging: readonly FacebookRequest[] }>[]
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
