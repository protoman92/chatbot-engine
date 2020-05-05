import { AmbiguousPlatform } from "./messenger";
import { AmbiguousRequestInput } from "./request";

export type KV<V> = Readonly<{ [K: string]: V | null | undefined }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export type BaseDefaultContext = AmbiguousRequestInput &
  Readonly<{
    activeBranch?: string;
    targetID: string;
    targetPlatform: AmbiguousPlatform;
  }>;

export interface ErrorContext {
  readonly error: Error;
}

export type Transformer<T> = (original: T) => Promise<T>;
