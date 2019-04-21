import { Context } from './common';

/** A platform-specific request. */
export type PlatformRequest = unknown;

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export interface GenericRequest<C extends Context> {
  readonly senderID: string;
  readonly oldContext: C;
  readonly data: readonly Readonly<{ text?: string; imageURL?: string }>[];
}
