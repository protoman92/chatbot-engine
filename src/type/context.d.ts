import { BaseRequest } from "./request";

export interface PlaceholderRequestInput {
  readonly type: "placebo";
}

export interface BaseContextChangeRequest<Context>
  extends BaseRequest<Context> {
  readonly input: PlaceholderRequestInput;
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly changedContext: Partial<Context>;
  readonly type: "context_trigger";
}
