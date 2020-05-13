import { FacebookRequest, FacebookRequestPerInput } from "./facebook";
import { TelegramRequest, TelegramRequestPerInput } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

interface PlaceholderRequestInput {
  readonly type: "placebo";
}

interface BaseCommonContextChangeRequest<Context> extends BaseRequest<Context> {
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly changedContext: Partial<Context>;
  readonly type: "context_trigger";
}

interface BaseContextChangeRequest<Context>
  extends BaseCommonContextChangeRequest<Context> {
  readonly input: readonly PlaceholderRequestInput[];
}

interface BaseContextChangeRequestPerInput<Context>
  extends BaseCommonContextChangeRequest<Context> {
  readonly input: PlaceholderRequestInput;
}

interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
  readonly type: "error";
}

interface BaseCommonErrorRequest<Context> extends BaseRequest<Context> {
  readonly type: "manual_trigger";
}

interface BaseErrorRequest<Context> extends BaseCommonErrorRequest<Context> {
  readonly input: readonly ErrorRequestInput[];
}

interface BaseErrorRequestPerInput<Context>
  extends BaseCommonErrorRequest<Context> {
  readonly input: ErrorRequestInput;
}

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
