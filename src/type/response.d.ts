import { FacebookResponse } from "./facebook";
import { AmbiguousRequestPerInput } from "./request";
import { TelegramResponse } from "./telegram";

export interface BaseResponse<Context> {
  readonly additionalContext?: Partial<Context>;
  readonly originalRequest: AmbiguousRequestPerInput<Context>;
  readonly targetID: string;
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 */
export type AmbiguousResponse<Context> =
  | FacebookResponse<Context>
  | TelegramResponse<Context>;
