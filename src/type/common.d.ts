export type KV<V> = Readonly<{ [K: string]: V }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface DefaultContext {
  readonly activeBranch?: string;
  readonly senderID: string;
  readonly inputText: string;
  readonly inputImageURL: string | undefined | null;
  readonly inputCoordinate: Coordinates | undefined | null;
}

export type ComposeFunc<T> = (original: T) => T;
