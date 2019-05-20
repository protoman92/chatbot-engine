import { mapSeries } from '../common/utils';
import {
  ContentObservable,
  ContentObserver,
  ContentSubject,
  ContentSubscription,
  InvalidNextResult as INR
} from '../type/stream';

/** Use this to signify invalid next result. */
export const STREAM_INVALID_NEXT_RESULT: INR = 'INVALID_NEXT_RESULT';

/** Create a subscription with custom unsubscribe logic. */
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
 */
export function createCompositeSubscription(
  ...subs: ContentSubscription[]
): ContentSubscription {
  return createSubscription(() => {
    return mapSeries(subs, sub => sub.unsubscribe());
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
  let isCompleted = false;

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
    next: async contents => {
      if (isCompleted) return STREAM_INVALID_NEXT_RESULT;

      return mapSeries(Object.entries(observerMap), ([id, obs]) => {
        return obs.next(contents);
      });
    },
    complete: async () => {
      if (isCompleted) return;

      await mapSeries(
        Object.entries(observerMap),
        async ([id, obs]) => !!obs.complete && obs.complete()
      );

      isCompleted = true;
    }
  };
}

/**
 * Merge the emissions of an Array of observables.
 * @template T The type of content being observed.
 */
export function mergeObservables<T>(
  ...observables: ContentObservable<T>[]
): ContentObservable<T> {
  return {
    subscribe: async observer => {
      const subscriptions = await mapSeries(observables, observable => {
        return observable.subscribe(observer);
      });

      return createCompositeSubscription(...subscriptions);
    }
  };
}

/**
 * Bridge input-output to allow async-await. This returns a higher-order
 * function that can accept multiple inputs.
 * @template I The input type.
 * @template O The output type.
 */
export function bridgeEmission<I, O>(
  source: ContentObserver<I> & ContentObservable<O>
): (input: I) => Promise<O> {
  return input => {
    return new Promise(async resolve => {
      const subscription = await source.subscribe({
        next: async content => {
          resolve(content);
          await subscription.unsubscribe();
          return {};
        }
      });

      source.next(input);
    });
  };
}
