import { Coordinates } from "./common";
import { Facebook } from "./facebook";
import { SupportedPlatform } from "./messenger";
import { Telegram } from "./telegram";

declare namespace GenericRequest {
  namespace Base {
    interface Input {
      readonly inputText: string;
      readonly inputImageURL: string;
      readonly inputCoordinate: Coordinates;
    }
  }
}

declare namespace GenericRequest {
  interface Base<C> {
    readonly targetID: string;
    readonly targetPlatform: SupportedPlatform;
    readonly oldContext: C;
    readonly input: readonly Base.Input[];
  }
}

declare namespace GenericRequest {
  type Input = Facebook.GenericRequest.Input | Telegram.GenericRequest.Input;
}

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export type GenericRequest<C> =
  | GenericRequest.Base<C>
  | Facebook.GenericRequest<C>
  | Telegram.GenericRequest<C>;
