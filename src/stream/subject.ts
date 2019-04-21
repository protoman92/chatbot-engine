import {
  ContentObservable,
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
 * Create a composite subscription to mass-unsubscribe from all internal
 * subscriptions.
 * @param subscriptions An Array of subscriptions.
 * @return A subscription instance.
 */
export function createCompositeSubscription(
  ...subscriptions: ContentSubscription[]
): ContentSubscription {
  return createSubscription(() => {
    subscriptions.forEach(subscription => subscription.unsubscribe());
  });
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
      return Promise.all(
        Object.entries(observerMap).map(([id, obs]) => obs.next(contents))
      );
    },
    complete: async () => {
      return Promise.all(
        Object.entries(observerMap).map(([id, obs]) => obs.complete())
      );
    }
  };
}

/**
 * Merge the emissions of an Array of observables.
 * @template T The type of content being observed.
 * @param observables An Array of observables.
 * @return An observable instance.
 */
export function mergeObservables<T>(
  ...observables: ContentObservable<T>[]
): ContentObservable<T> {
  return {
    subscribe: observer =>
      createCompositeSubscription(
        ...observables.map(observable => observable.subscribe(observer))
      )
  };
}
