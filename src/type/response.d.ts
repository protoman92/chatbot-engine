import { GenericFacebookResponse } from "./facebook";
import { SupportedPlatform } from "./messenger";
import { GenericTelegramResponse } from "./telegram";
import { VisualContent } from "./visual-content";

export interface RootGenericResponse<C> {
  readonly targetID: string;
  readonly targetPlatform: SupportedPlatform;
  readonly additionalContext?: Partial<C>;
  readonly output: readonly VisualContent.Base[];
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 * @template C The context used by the current chatbot.
 */
export type GenericResponse<C> =
  | RootGenericResponse<C>
  | GenericFacebookResponse<C>
  | GenericTelegramResponse<C>;
