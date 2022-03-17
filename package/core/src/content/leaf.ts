import { createContentSubject, createSubscription } from "../stream";
import {
  AmbiguousGenericResponse,
  AmbiguousLeaf,
  ContentObservable,
  ContentObserver,
  ContentSubscription,
  CreateLeaf,
  ErrorLeafConfig,
  LeafError,
  _CreateLeaf,
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

/**
 * Bridge input-output to allow async-await. This returns a higher-order
 * function that can accept multiple inputs.
 */
export function bridgeEmission<I, O>(
  source: ContentObserver<I, NextResult> &
    ContentObservable<ContentObserver<O, NextResult>>
): (input: I) => Promise<O> {
  return (input) => {
    return new Promise(async (resolve) => {
      const subscription = await source.subscribe({
        next: async (content) => {
          resolve(content);
          await subscription.unsubscribe();
          return NextResult.BREAK;
        },
      });

      source.next(input);
    });
  };
}

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 */
export const createLeaf: CreateLeaf = async (fn) => {
  const observerMap: Record<
    string,
    Parameters<AmbiguousLeaf["subscribe"]>[0]
  > = {};

  let observerID = 1;

  return {
    next: async (request) => {
      const baseSubject = createContentSubject<
        Pick<AmbiguousGenericResponse, "originalRequest"> &
          _CreateLeaf.GenericResponseToNext,
        NextResult
      >((...nextOutputs) => {
        return nextOutputs.every(
          (nextOutput) => nextOutput === NextResult.BREAK
        )
          ? NextResult.BREAK
          : NextResult.FALLTHROUGH;
      });

      const subject: typeof baseSubject = {
        ...baseSubject,
        next: (response) => {
          return baseSubject.next({
            targetID: request.targetID,
            targetPlatform: request.targetPlatform,
            ...response,
            originalRequest: request,
          });
        },
      };

      let subscriptions: ContentSubscription[] = [];

      for (const observer of Object.values(observerMap)) {
        const subscription = await subject.subscribe(observer);
        subscriptions.push(subscription);
      }

      try {
        const baseLeaf = await Promise.resolve(fn(subject));
        return await Promise.resolve(baseLeaf.next(request));
      } catch (error) {
        (error as LeafError).currentLeafName = request.currentLeafName;
        throw error;
      } finally {
        for (const subscription of subscriptions) {
          await Promise.resolve(subscription.unsubscribe());
        }
      }
    },
    subscribe: (observer) => {
      const currentID = observerID;
      observerID += 1;
      observerMap[currentID] = observer;

      const subscription = createSubscription(() => {
        delete observerMap[currentID];
      });

      return Promise.resolve(subscription);
    },
  };
};

/**
 * Create an error leaf that will be used to deliver error messages if no
 * other leaf can handle the error.
 */
export function createDefaultErrorLeaf({
  formatErrorMessage,
  trackError,
}: ErrorLeafConfig): Promise<AmbiguousLeaf> {
  return createLeaf((observer) => ({
    next: ({ input, targetID, targetPlatform }) => {
      if (input.type !== "error") {
        return NextResult.FALLTHROUGH;
      }

      const { error, erroredLeaf } = input;

      if (trackError != null) {
        trackError({ error, erroredLeaf, targetID, targetPlatform });
      }

      return observer.next({
        targetID,
        targetPlatform,
        output: [
          { content: { type: "text", text: formatErrorMessage(error) } },
        ],
      });
    },
  }));
}
