import { BaseRequest } from "./request";

export interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
  readonly type: "error";
}

export interface BaseErrorRequest<Context> extends BaseRequest<Context> {
  readonly input: ErrorRequestInput;
  readonly type: "manual_trigger";
}
