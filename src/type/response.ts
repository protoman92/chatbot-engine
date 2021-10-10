import { FacebookResponse } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { AmbiguousRequest } from "./request";
import { TelegramResponse } from "./telegram";

export interface BaseResponse<Context> {
  readonly additionalContext?: Partial<Context>;
  /**
   * If this response is sent organically (i.e. not manually invoked to send
   * a custom message not triggered by the user), the original request will be
   * available in order to trigger context change requests.
   */
  readonly originalRequest?: AmbiguousRequest<Context>;
  readonly targetID: string;
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 */
export type AmbiguousResponse<Context> =
  | (FacebookResponse<Context> | TelegramResponse<Context>)
  | (BaseResponse<Context> & {
      output: readonly (
        | FacebookResponse<Context>["output"][number]
        | TelegramResponse<Context>["output"][number]
      )[];
      targetPlatform: AmbiguousPlatform;
    });
