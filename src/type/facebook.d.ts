import { DeepReadonly } from 'ts-essentials';

interface BaseFacebookRequest {
  readonly sender: Readonly<{ id: string }>;
  readonly recipient: Readonly<{ id: string }>;
  readonly timestamp: number;
}

declare namespace FacebookRequest {
  export interface Postback extends BaseFacebookRequest {
    readonly postback: Readonly<{ payload: string; title: string }>;
  }

  export interface Message extends BaseFacebookRequest {
    readonly message: Readonly<{ mid: string; seq: number }>;
  }

  export namespace Message {
    export type Text = Message & DeepReadonly<{ message: { text: string } }>;

    export type Attachment = Message &
      DeepReadonly<{ attachments: { type: 'image'; payload: unknown }[] }>;

    export namespace Attachment {
      export type Image = Attachment &
        DeepReadonly<{
          attachments: { type: 'image'; payload: { url: string } }[];
        }>;
    }
  }
}

/** Represents possible combinations of Facebook requests. */
export type FacebookRequest =
  | FacebookRequest.Message.Text
  | FacebookRequest.Message.Attachment.Image
  | FacebookRequest.Postback;

/** Represents a webhook request. */
export interface FacebookWebhookRequest {
  readonly object: 'page';
  readonly entry:
    | Readonly<{ messaging: FacebookRequest[] }>[]
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
}
