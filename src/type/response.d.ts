import { FacebookResponse } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { TelegramResponse } from "./telegram";
import { BaseResponseOutput } from "./visual-content";

export interface BaseResponse<C> {
  readonly targetID: string;
  readonly targetPlatform: AmbiguousPlatform;
  readonly additionalContext?: Partial<C>;
  readonly output: readonly BaseResponseOutput[];
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 * @template C The context used by the current chatbot.
 */
export type AmbiguousResponse<C> =
  | BaseResponse<C>
  | FacebookResponse<C>
  | TelegramResponse<C>;
