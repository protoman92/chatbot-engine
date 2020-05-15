import { BaseRequest } from "./request";

export interface PlaceholderRequestInput {
  readonly type: "placebo";
}

export interface BaseContextChangeRequest<Context>
  extends BaseRequest<Context> {
  readonly input: readonly PlaceholderRequestInput[];
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly changedContext: Partial<Context>;
  readonly type: "context_trigger";
}

export type BaseContextChangeRequestPerInput<Context> = Omit<
  BaseContextChangeRequest<Context>,
  "input"
> &
  Readonly<{ input: BaseContextChangeRequest<Context>["input"][0] }>;
