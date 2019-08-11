import { SupportedPlatform } from "./messenger";
import { GenericRequest } from "./request";

export type KV<V> = Readonly<{ [K: string]: V | null | undefined }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export type DefaultContext = GenericRequest.Input &
  Readonly<{
    activeBranch?: string;
    targetID: string;
    targetPlatform: SupportedPlatform;
  }>;

export interface ErrorContext {
  readonly error: Error;
}

export type PromiseConvertible<T> = T | Promise<T> | (() => Promise<T>);
export type Transformer<T> = (original: T) => Promise<T>;
export type StringKeys<T> = Extract<keyof T, string>;
