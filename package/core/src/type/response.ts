import { FacebookGenericResponse } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { AmbiguousGenericRequest } from "./request";
import { TelegramGenericResponse } from "./telegram";

export interface BaseGenericResponse<Context> {
  readonly additionalContext?: Partial<Context>;
  /**
   * If this response is sent organically (i.e. not manually invoked to send
   * a custom message not triggered by the user), the original request will be
   * available in order to trigger context change requests.
   */
  readonly originalRequest?: AmbiguousGenericRequest<Context>;
  readonly targetID: string;
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 */
export type AmbiguousGenericResponse<Context> =
  | (FacebookGenericResponse<Context> | TelegramGenericResponse<Context>)
  | (BaseGenericResponse<Context> & {
      output: readonly (
        | FacebookGenericResponse<Context>["output"][number]
        | TelegramGenericResponse<Context>["output"][number]
      )[];
      targetPlatform: AmbiguousPlatform;
    });
