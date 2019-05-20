import { Coordinates } from './common';
import { SupportedPlatform } from './messenger';

declare namespace GenericRequest {
  interface BaseInput {
    readonly inputText: string;
    readonly inputImageURL: string;
    readonly inputCoordinate: Coordinates;
  }

  namespace Input {
    interface Facebook extends BaseInput {
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
