import { BaseRequest } from "./request";

export interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
  readonly type: "error";
}

export interface BaseErrorRequest<Context> extends BaseRequest<Context> {
  readonly input: readonly ErrorRequestInput[];
  readonly type: "manual_trigger";
}

export type BaseErrorRequestPerInput<Context> = Omit<
  BaseErrorRequest<Context>,
  "input"
> &
  Readonly<{ input: BaseErrorRequest<Context>["input"][0] }>;
