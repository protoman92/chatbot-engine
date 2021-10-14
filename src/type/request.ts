import { ContextChangeRequestInput } from "./context";
import { ErrorRequestInput } from "./error";
import { FacebookGenericRequest } from "./facebook";
import { TelegramGenericRequest } from "./telegram";
import { WitRequestInput } from "./wit";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

export type CrossPlatformRequestInput<Context> =
  | Readonly<{ text: string; type: "text" }>
  | Readonly<{ type: "placebo" }>
  | ContextChangeRequestInput<Context>
  | ErrorRequestInput
  | WitRequestInput;

export interface GenericMessageTriggerRequest<RawRequest> {
  readonly rawRequest: RawRequest;
  readonly type: "message_trigger";
}

export interface GenericManualTriggerRequest {
  readonly rawRequest?: undefined;
  readonly type: "manual_trigger";
}

export type AmbiguousGenericRequest<Context> =
  | FacebookGenericRequest<Context>
  | TelegramGenericRequest<Context>;
