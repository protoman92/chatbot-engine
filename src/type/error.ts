export interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
  readonly type: "error";
}
