import { Coordinates } from './common';
import { SupportedPlatform } from './messenger';

declare namespace GenericRequest {
  namespace Input {
    interface Base {
      readonly inputText: string;
      readonly inputImageURL: string;
      readonly inputCoordinate: Coordinates;
    }

    interface Facebook extends Base {
      readonly stickerID: string;
    }
  }

  type Input = Input.Facebook;
}

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export interface GenericRequest<C> {
  readonly senderID: string;
  readonly senderPlatform: SupportedPlatform;
  readonly oldContext: C;
  readonly data: readonly GenericRequest.Input[];
}
