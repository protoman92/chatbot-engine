export type Resolvable<T> = T | Promise<T>;
export type KV<V> = Readonly<{ [K: string]: V }>;

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export type Transformer<T> = (original: T) => Promise<T>;
