import { Coordinates } from './common';
import { SupportedPlatform } from './messenger';

/** A platform-specific request. */
export type PlatformRequest = unknown;

declare namespace GenericRequest {
  /** Input for a generic request. */
  export interface Input {
    readonly inputText: string;
    readonly inputImageURL: string;
    readonly inputCoordinate: Coordinates;

    /**
     * Note that this is not a completely reliable way of determining if a
     * message contains a sticker attachment. Use with caution.
     */
    readonly hasStickerAttachment: boolean;
  }
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
