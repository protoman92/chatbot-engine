import { AsyncOrSync } from "ts-essentials";

export type KV<V> = Readonly<{ [K: string]: V }>;

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export type Transformer<T> = (original: T) => AsyncOrSync<T>;
