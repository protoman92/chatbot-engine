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
export function createSubscription(
  unsub: () => Promise<unknown>
): ContentSubscription {
  let isUnsubscribed = false;

  return {
    unsubscribe: async () => {
      if (!isUnsubscribed) {
        await unsub();
        isUnsubscribed = true;
      }
    }
  };
}

/**
 * Create a composite subscription to mass-unsubscribe from all internal
 * subscriptions.
 * @param subs An Array of subscriptions.
 * @return A subscription instance.
 */
export function createCompositeSubscription(
  ...subs: ContentSubscription[]
): ContentSubscription {
  return createSubscription(() => {
    return Promise.all(subs.map(sub => sub.unsubscribe()));
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
    subscribe: async observer => {
      const observerID = currentID;
      currentID += 1;
      observerMap[observerID] = observer;

      return createSubscription(async () => {
        delete observerMap[observerID];
        return !!observer.complete && observer.complete();
      });
    },
    next: contents => {
      return Promise.all(
        Object.entries(observerMap).map(([id, obs]) => obs.next(contents))
      );
    },
    complete: async () => {
      return Promise.all(
        Object.entries(observerMap).map(
          async ([id, obs]) => !!obs.complete && obs.complete()
        )
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
    subscribe: async observer => {
      const subscriptions = await Promise.all(
        observables.map(observable => observable.subscribe(observer))
      );

      return createCompositeSubscription(...subscriptions);
    }
  };
}
