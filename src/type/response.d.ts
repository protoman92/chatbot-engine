import { FacebookVisualContent } from './facebook';
import { SupportedPlatform } from './messenger';

declare namespace GenericResponse {
  interface Base<C> {
    readonly senderID: string;
    readonly additionalContext?: Partial<C>;
  }

  interface Facebook<C> extends Base<C> {
    readonly senderPlatform: SupportedPlatform;
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
