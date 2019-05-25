import { SupportedPlatform } from './messenger';
import { GenericRequest } from './request';

export type KV<V> = Readonly<{ [K: string]: V | null | undefined }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export type DefaultContext = GenericRequest.Data &
  Readonly<{
    readonly activeBranch?: string;
    readonly targetID: string;
    readonly targetPlatform: SupportedPlatform;
  }>;

export interface ErrorContext {
  readonly error: Error;
}

export type Transformer<T> = (original: T) => T;
