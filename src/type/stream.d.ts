/**
 * Represents the result of calling next on an observer. This is usually not
 * particularly useful, unless we want to detect the first successful next
 * operation.
 */
export type NextResult = {} | null;

/** Represents a subscription to some content stream. */
export interface ContentSubscription {
  /** Unsubscribe from the underlying stream. */
  unsubscribe(): Promise<unknown>;
}

/**
 * Represents an observer for contents of some type.
 * @template T The type of content being observed.
 */
export interface ContentObserver<T> {
  next(content: T): Promise<NextResult>;
  complete?(): Promise<unknown>;
}

/**
 * Observe some contents on subscription.
 * @template T The type of content being observed.
 */
export interface ContentObservable<T> {
  /**
   * Subscribe to this stream's contents.
   * @param observer A content observer object.
   * @return A Promise of subscription.
   */
  subscribe(observer: ContentObserver<T>): Promise<ContentSubscription>;
}

/**
 * Represents both an observable and an observer.
 * @template T The type of content being observed.
 */
export interface ContentSubject<T>
  extends ContentObservable<T>,
    Required<ContentObserver<T>> {}
