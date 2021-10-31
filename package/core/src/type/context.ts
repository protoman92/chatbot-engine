export interface ContextChangeRequestInput<Context> {
  readonly changedContext: Partial<Context>;
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly type: "context_change";
}
