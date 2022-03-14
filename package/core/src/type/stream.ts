import { AsyncOrSync } from "ts-essentials";

/** Represents a subscription to some content stream */
export interface ContentSubscription {
  /** Unsubscribe from the underlying stream */
  unsubscribe(): Promise<void>;
}

/** Represents an observer that accepts contents of some type */
export interface NextContentObserver<I, O> {
  next(content: I): AsyncOrSync<O>;
}

/** Represents an observer for contents of some type */
export interface ContentObserver<I, O> extends NextContentObserver<I, O> {}

/** Observe some contents on subscription */
export interface ContentObservable<
  Observer extends ContentObserver<unknown, unknown>
> {
  /** Subscribe to this stream's contents */
  subscribe(observer: Observer): Promise<ContentSubscription>;
}

/** Represents both an observable and an observer */
export interface ContentSubject<I, O>
  extends ContentObservable<ContentObserver<I, O>>,
    ContentObserver<I, O> {}
