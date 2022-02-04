export interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string | undefined;
  readonly type: "error";
}

export interface LeafError extends Error {
  currentLeafName?: string;
}
