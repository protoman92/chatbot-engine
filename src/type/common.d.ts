export type KV<V> = Readonly<{ [K: string]: V }>;

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface DefaultContext {
  readonly activeBranch?: string;
  readonly senderID: unknown;
}

export type ComposeFunc<T> = (original: T) => T;
