import { Coordinates } from './common';

/** A platform-specific request. */
export type PlatformRequest = unknown;

declare namespace GenericRequest {
  /** Input for a generic request. */
  export interface Input {
    readonly inputText: string;
    readonly inputImageURL: string | undefined;
    readonly inputCoordinates: Coordinates | undefined;
  }
}

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export interface GenericRequest<C> {
  readonly senderID: string;
  readonly oldContext: C;
  readonly data: readonly GenericRequest.Input[];
}
