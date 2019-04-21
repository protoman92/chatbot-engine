import { Context } from './common';
import { VisualContent } from './visual-content';

/** A platform-specific response. */
export type PlatformResponse = unknown;

/**
 * A generic outgoing response.
 * @template C The context used by the current chatbot.
 */
export interface GenericResponse<C extends Context> {
  readonly senderID: string;
  readonly newContext?: C;
  readonly visualContents: readonly VisualContent[];
}
