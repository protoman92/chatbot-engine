export type KV<V> = Readonly<{ [K: string]: V }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface DefaultContext {
  readonly activeBranch?: string;
  readonly senderID: unknown;
}

export type ComposeFunc<T> = (original: T) => T;
