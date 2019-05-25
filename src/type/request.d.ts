import { Coordinates } from './common';
import { Facebook } from './facebook';
import { SupportedPlatform } from './messenger';
import { Telegram } from './telegram';

declare namespace GenericRequest {
  namespace Data {
    interface Base {
      readonly inputText: string;
      readonly inputImageURL: string;
      readonly inputCoordinate: Coordinates;
    }
  }

  interface Base<C> {
    readonly targetID: string;
    readonly targetPlatform: SupportedPlatform;
    readonly oldContext: C;
    readonly data: readonly Data.Base[];
  }
}

declare namespace GenericRequest {
  type Data = Facebook.GenericRequest.Data | Telegram.GenericRequest.Data;
}

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export type GenericRequest<C> =
  | GenericRequest.Base<C>
  | Facebook.GenericRequest<C>
  | Telegram.GenericRequest<C>;
