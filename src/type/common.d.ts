export type Resolvable<T> = T | Promise<T>;
export type KV<V> = Readonly<{ [K: string]: V | null | undefined }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export type Transformer<T> = (original: T) => Promise<T>;
