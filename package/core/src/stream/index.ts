import { AsyncOrSync } from "ts-essentials";
import { mapSeries } from "../common/utils";
import {
  ContentObservable,
  ContentObserver,
  ContentSubject,
  ContentSubscription,
} from "../type";

/**
 * Represents the result of calling next on an observer. This is usually not
 * particularly useful, unless we want to detect the first successful next
 * operation.
 */
export enum NextResult {
  BREAK = "BREAK",
  FALLTHROUGH = "FALLTHROUGH",
}

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
export function createContentSubject<T>(): ContentSubject<T> {
  const observerMap: { [K: number]: ContentObserver<T> } = {};
  let currentID = 0;
  let isCompleted = false;

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
      if (isCompleted) {
        return NextResult.FALLTHROUGH;
      }

      return mapSeries(Object.entries(observerMap), ([, obs]) => {
        return obs.next(contents);
      }).then((results) =>
        results.every((result) => result === NextResult.BREAK)
          ? NextResult.BREAK
          : NextResult.FALLTHROUGH
      );
    },
  };
}

/** Merge the emissions of an Array of observables */
export function mergeObservables<T>(
  ...observables: ContentObservable<T>[]
): ContentObservable<T> {
  return {
    subscribe: async (observer) => {
      const subscriptions = await mapSeries(observables, (observable) => {
        return observable.subscribe(observer);
      });

      return createCompositeSubscription(...subscriptions);
    },
  };
}

/**
 * Bridge input-output to allow async-await. This returns a higher-order
 * function that can accept multiple inputs.
 */
export function bridgeEmission<I, O>(
  source: ContentObserver<I> & ContentObservable<O>
): (input: I) => Promise<O> {
  return (input) => {
    return new Promise(async (resolve) => {
      const subscription = await Promise.resolve(
        source.subscribe({
          next: async (content) => {
            resolve(content);
            await subscription.unsubscribe();
            return NextResult.BREAK;
          },
        })
      );

      source.next(input);
    });
  };
}
