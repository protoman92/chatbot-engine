import {
  ContentObserver,
  ContentSubject,
  ContentSubscription
} from '../type/stream';

/**
 * Create a subscription with custom unsubscribe logic.
 * @param unsub Unsubscription logic.
 * @return A content subscription object.
 */
export function createSubscription(unsub: () => unknown): ContentSubscription {
  let isUnsubscribed = false;

  return {
    unsubscribe: () => {
      if (!isUnsubscribed) {
        unsub();
        isUnsubscribed = true;
      }
    }
  };
}

/**
 * Create a content subject that broadcasts changes to registered observers.
 * @template T The type of content being observed.
 * @return A content subject instance.
 */
export function createContentSubject<T>(): ContentSubject<T> {
  const observerMap: { [K: number]: ContentObserver<T> } = {};
  let currentID = 0;

  return {
    subscribe: observer => {
      const observerID = currentID;
      currentID += 1;
      observerMap[observerID] = observer;

      return createSubscription(() => {
        delete observerMap[observerID];
        observer.complete();
      });
    },
    next: contents => {
      Object.entries(observerMap).forEach(([id, observer]) =>
        observer.next(contents)
      );
    },
    complete: () => {
      Object.entries(observerMap).forEach(([id, observer]) =>
        observer.complete()
      );
    }
  };
}
