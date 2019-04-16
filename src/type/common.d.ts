export type KV<V> = Readonly<{ [K: string]: V }>;
export type Context = KV<unknown>;
