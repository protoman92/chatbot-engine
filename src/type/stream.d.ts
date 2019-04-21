/** Represents a subscription to some content stream. */
export interface ContentSubscription {
  /** Unsubscribe from the underlying stream. */
  unsubscribe(): unknown;
}

/**
 * Represents an observer that only knows how to accept content.
 * @template T The type of content being observed.
 */
export interface NextContentObserver<T> {
  next(content: T): Promise<unknown>;
}

/**
 * Represents an observer for contents of some type.
 * @template T The type of content being observed.
 */
export interface ContentObserver<T> extends NextContentObserver<T> {
  complete(): Promise<unknown>;
}

/**
 * Observe some contents on subscription.
 * @template T The type of content being observed.
 */
export interface ContentObservable<T> {
  /**
   * Subscribe to this stream's contents.
   * @param observer A content observer object.
   */
  subscribe(observer: ContentObserver<T>): ContentSubscription;
}

/**
 * Represents both an observable and an observer.
 * @template T The type of content being observed.
 */
export interface ContentSubject<T>
  extends ContentObservable<T>,
    ContentObserver<T> {}
