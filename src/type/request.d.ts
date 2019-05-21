import { Coordinates } from './common';
import { SupportedPlatform } from './messenger';

declare namespace GenericRequest {
  namespace Data {
    interface Base {
      readonly inputText: string;
      readonly inputImageURL: string;
      readonly inputCoordinate: Coordinates;
    }

    interface Facebook extends Base {
      readonly senderPlatform: 'facebook';
      readonly stickerID: string;
    }

    interface Telegram extends Base {
      readonly senderPlatform: 'telegram';
    }
  }

  type Data = Data.Facebook | Data.Telegram;

  interface Base<C> {
    readonly senderID: string;
    readonly senderPlatform: SupportedPlatform;
    readonly oldContext: C;
    readonly data: readonly Data[];
  }

  interface Facebook<C> extends Base<C> {
    readonly senderPlatform: 'facebook';
    readonly data: readonly Data.Facebook[];
  }

  interface Telegram<C> extends Base<C> {
    readonly senderPlatform: 'telegram';
    readonly data: readonly Data.Telegram[];
  }
}

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export type GenericRequest<C> =
  | GenericRequest.Base<C>
  | GenericRequest.Facebook<C>
  | GenericRequest.Telegram<C>;
