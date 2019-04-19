export type KV<V> = Readonly<{ [K: string]: V }>;

export interface DefaultContext {
  readonly activeBranch?: string;
  readonly userID: unknown;
}

export interface Context extends KV<unknown>, DefaultContext {}
export type ComposeFunc<T> = (original: T) => T;
