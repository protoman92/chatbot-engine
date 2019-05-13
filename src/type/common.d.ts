import { GenericRequest } from './request';

export type KV<V> = Readonly<{ [K: string]: V | null | undefined }>;

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface DefaultContext extends GenericRequest.Input {
  readonly activeBranch?: string;
  readonly senderID: string;
}

export interface ErrorContext {
  readonly error: Error;
}

export type Transformer<T> = (original: T) => T;
