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

export interface ContextWithError {
  readonly error: Error;
}

export type Transformer<T> = (original: T) => T;
