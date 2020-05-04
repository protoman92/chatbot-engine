import { FacebookResponse } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { TelegramResponse } from "./telegram";
import { AmbiguousResponseOutput } from "./visual-content";

export interface BaseResponse<Context> {
  readonly targetID: string;
  readonly targetPlatform: AmbiguousPlatform;
  readonly additionalContext?: Partial<Context>;
  readonly output: readonly AmbiguousResponseOutput[];
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 */
export type AmbiguousResponse<Context> =
  | BaseResponse<Context>
  | FacebookResponse<Context>
  | TelegramResponse<Context>;
