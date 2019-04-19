export type KV<V> = Readonly<{ [K: string]: V }>;

export interface Context extends KV<unknown> {
  readonly activeBranch?: string;
  readonly userID: unknown;
}
