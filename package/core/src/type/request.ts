import { ChatbotContext } from "..";
import { ContextChangeRequestInput } from "./context";
import { ErrorRequestInput } from "./error";
import { FacebookGenericRequest } from "./facebook";
import { TelegramGenericRequest } from "./telegram";
import { WitRequestInput } from "./wit";

export type BaseRequest = Readonly<{
  currentContext: ChatbotContext;
  targetID: string;
}>;

export type CrossPlatformRequestInput =
  | Readonly<{ text: string; type: "text" }>
  | Readonly<{ type: "placebo" }>
  | ContextChangeRequestInput
  | ErrorRequestInput
  | WitRequestInput;

export interface GenericMessageTriggerRequest<RawRequest> {
  readonly rawRequest: RawRequest;
  readonly triggerType: "message";
}

export interface GenericManualTriggerRequest {
  readonly rawRequest?: undefined;
  readonly triggerType: "manual";
}

export type AmbiguousGenericRequest =
  | FacebookGenericRequest
  | TelegramGenericRequest;
