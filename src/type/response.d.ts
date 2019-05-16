import { FacebookVisualContent } from './facebook-visual-content';
import { SupportedPlatform } from './messenger';
import { VisualContent } from './visual-content';

/** A platform-specific response. */
export type PlatformResponse = unknown;

interface BaseGenericResponse<C> {
  readonly senderID: string;
  readonly additionalContext?: Partial<C>;
}

declare namespace GenericResponse {
  interface Facebook<C> extends BaseGenericResponse<C> {
    readonly senderPlatform: 'facebook';
    readonly visualContents: readonly FacebookVisualContent[];
  }
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 * @template C The context used by the current chatbot.
 */
export type GenericResponse<C> = GenericResponse.Facebook<C>;
