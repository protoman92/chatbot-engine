import { NextResult } from "../stream";

/** Represents a subscription to some content stream */
export interface ContentSubscription {
  /** Unsubscribe from the underlying stream */
  unsubscribe(): Promise<unknown>;
}

/** Represents an observer that accepts contents of some type */
export interface NextContentObserver<T> {
  next(content: T): Promise<NextResult>;
}

/** Represents an observer for contents of some type */
export interface ContentObserver<T> extends NextContentObserver<T> {
  complete?(): Promise<unknown>;
}

/** Observe some contents on subscription */
export interface ContentObservable<T> {
  /** Subscribe to this stream's contents */
  subscribe(observer: ContentObserver<T>): Promise<ContentSubscription>;
}

/** Represents both an observable and an observer */
export interface ContentSubject<T>
  extends ContentObservable<T>,
    Required<ContentObserver<T>> {}
