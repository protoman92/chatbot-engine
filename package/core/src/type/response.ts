import { ChatbotContext } from "..";
import { FacebookGenericResponse } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { AmbiguousGenericRequest } from "./request";
import { TelegramGenericResponse } from "./telegram";

export interface BaseGenericResponse {
  readonly additionalContext?: Partial<ChatbotContext>;
  /**
   * If this response is sent organically (i.e. not manually invoked to send
   * a custom message not triggered by the user), the original request will be
   * available in order to trigger context change requests.
   */
  readonly originalRequest?: AmbiguousGenericRequest | undefined;
  readonly targetID: string;
}

/**
 * A generic outgoing response. We can specify additional context to add to
 * the existing context in persistence (emphasis on addition, not replacement).
 * This is to prevent stale old context replacing latest one.
 */
export type AmbiguousGenericResponse =
  | (FacebookGenericResponse | TelegramGenericResponse)
  | (BaseGenericResponse & {
      output: readonly (
        | FacebookGenericResponse["output"][number]
        | TelegramGenericResponse["output"][number]
      )[];
      targetPlatform: AmbiguousPlatform;
    });
