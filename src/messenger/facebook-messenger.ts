import { DeepReadonly } from 'ts-essentials';

type BaseFacebookRequest = Readonly<{
  sender: Readonly<{ id: string }>;
  recipient: Readonly<{ id: string }>;
  timestamp: number;
}>;

namespace FacebookRequest {
  export type Postback = BaseFacebookRequest &
    DeepReadonly<{ postback: { payload: string; title: string } }>;

  export type Message = BaseFacebookRequest &
    DeepReadonly<{ message: { mid: string; seq: number } }>;

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
export type FacebookWebhookRequest = Readonly<{
  object: 'page';
  entry: Readonly<{ messaging: FacebookRequest[] }>[] | undefined | null;
}>;

/** Represents a Facebook user. */
export type FacebookUser = Readonly<{
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  id: string;
}>;
