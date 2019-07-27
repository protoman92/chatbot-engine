import { Facebook } from "./facebook";
import { SupportedPlatform } from "./messenger";
import { Telegram } from "./telegram";
import { VisualContent } from "./visual-content";

declare namespace GenericResponse {
  export interface Base<C> {
    readonly targetID: string;
    readonly targetPlatform: SupportedPlatform;
    readonly additionalContext?: Partial<C>;
    readonly output: readonly VisualContent.Base[];
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
  | Facebook.GenericResponse<C>
  | Telegram.GenericResponse<C>;
