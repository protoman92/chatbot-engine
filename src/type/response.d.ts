import { Context } from './common';
import { VisualContent } from './visual-content';

/** A platform-specific response. */
export type PlatformResponse = unknown;

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 * @template C The context used by the current chatbot.
 */
export interface GenericResponse<C extends Context> {
  readonly senderID: string;
  readonly additionalContext?: C;
  readonly visualContents: readonly VisualContent[];
}
