import { ContextChangeRequestInput } from "./context";
import { ErrorRequestInput } from "./error";
import { FacebookRequest } from "./facebook";
import { TelegramRequest } from "./telegram";
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

export type CrossPlatformRequest<Context> = BaseRequest<Context> &
  Readonly<{ targetPlatform: string }> &
  (
    | Readonly<{
        input: CrossPlatformRequestInput<Context>;
        type: "message_trigger";
      }>
    | Readonly<{
        input: CrossPlatformRequestInput<Context>;
        type: "manual_trigger";
      }>
  );

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;
