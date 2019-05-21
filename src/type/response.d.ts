import { SupportedPlatform } from './messenger';
import { VisualContent } from './visual-content';

declare namespace GenericResponse {
  interface Base<C> {
    readonly senderID: string;
    readonly senderPlatform: SupportedPlatform;
    readonly additionalContext?: Partial<C>;
    readonly visualContents: readonly VisualContent[];
  }

  interface Facebook<C> extends Base<C> {
    readonly senderPlatform: 'facebook';
    readonly visualContents: readonly VisualContent.Facebook[];
  }

  interface Telegram<C> extends Base<C> {
    readonly senderPlatform: 'telegram';
    readonly visualContents: readonly VisualContent.Telegram[];
  }
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 * @template C The context used by the current chatbot.
 */
export type GenericResponse<C> =
  | GenericResponse.Base<C>
  | GenericResponse.Facebook<C>
  | GenericResponse.Telegram<C>;
