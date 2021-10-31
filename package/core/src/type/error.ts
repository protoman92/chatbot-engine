export interface ErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
  readonly type: "error";
}

export interface LeafError extends Error {
  currentLeafName?: string;
}
