import { ChatbotContext } from "..";
import { ContextChangeRequestInput } from "./context";
import { ErrorRequestInput } from "./error";
import { FacebookGenericRequest } from "./facebook";
import { TelegramGenericRequest } from "./telegram";
import { WitRequestInput } from "./wit";

export interface CommonGenericRequest {
  readonly currentContext: ChatbotContext;
  readonly targetID: string;
}

export interface GenericMessageTriggerRequest<RawRequest> {
  readonly input:
    | Readonly<{ text: string; type: "text" }>
    | Readonly<{ type: "placebo" }>;
  readonly rawRequest: RawRequest;
  readonly triggerType: "message";
}

export interface GenericManualTriggerRequest {
  readonly input:
    | ContextChangeRequestInput
    | ErrorRequestInput
    | WitRequestInput;
  readonly rawRequest?: undefined;
  readonly triggerType: "manual";
}

export type AmbiguousGenericRequest =
  | FacebookGenericRequest
  | TelegramGenericRequest;
