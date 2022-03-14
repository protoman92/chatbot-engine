import { AsyncOrSync } from "ts-essentials";
import { mapSeries } from "../common/utils";
import {
  ContentObservable,
  ContentObserver,
  ContentSubject,
  ContentSubscription,
} from "../type";

/** Create a subscription with custom unsubscribe logic */
export function createSubscription(
  unsub: () => AsyncOrSync<void>
): ContentSubscription {
  let isUnsubscribed = false;

  return {
    /** Synchronize access to isUnsubscribed */
    unsubscribe: () => {
      if (isUnsubscribed) {
        return Promise.resolve(undefined);
      }

      isUnsubscribed = true;
      return Promise.resolve(unsub());
    },
  };
}

/**
 * Create a composite subscription to mass-unsubscribe from all internal
 * subscriptions.
 */
export function createCompositeSubscription(
  ...subs: ContentSubscription[]
): ContentSubscription {
  return createSubscription(() => {
    return mapSeries(subs, (sub) => {
      return sub.unsubscribe();
    }).then(() => {
      return undefined;
    });
  });
}

/** Create a content subject that broadcasts changes to registered observers */
export function createContentSubject<I, O>(
  mergeNextOutputs: (...args: readonly O[]) => O
): ContentSubject<I, O> {
  const observerMap: { [K: number]: ContentObserver<I, O> } = {};
  let currentID = 0;

  return {
    subscribe: (observer) => {
      const observerID = currentID;
      currentID += 1;
      observerMap[observerID] = observer;

      return createSubscription(async () => {
        delete observerMap[observerID];
      });
    },
    next: (contents) => {
      return mapSeries(Object.entries(observerMap), ([, obs]) => {
        return obs.next(contents);
      }).then((outputs) => {
        return mergeNextOutputs(...outputs);
      });
    },
  };
}

/** Merge the emissions of an Array of observables */
export function mergeObservables<
  Observer extends ContentObserver<unknown, unknown>
>(...observables: ContentObservable<Observer>[]): ContentObservable<Observer> {
  return {
    subscribe: async (observer) => {
      const subscriptions = await mapSeries(observables, (observable) => {
        return observable.subscribe(observer);
      });

      return createCompositeSubscription(...subscriptions);
    },
  };
}
