import { FacebookRequest, FacebookRequestPerInput } from "./facebook";
import { TelegramRequest, TelegramRequestPerInput } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

interface PlaceholderRequestInput {
  readonly type: "placebo";
}

interface BaseContextChangeRequestPerInput<Context>
  extends BaseRequest<Context> {
  readonly input: PlaceholderRequestInput;
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly changedContext: Partial<Context>;
  readonly type: "context_trigger";
}

interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
  readonly type: "error";
}

interface BaseErrorRequestPerInput<Context> extends BaseRequest<Context> {
  readonly input: ErrorRequestInput;
  readonly type: "manual_trigger";
}

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
