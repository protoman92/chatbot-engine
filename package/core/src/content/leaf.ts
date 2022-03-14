import { AsyncOrSync } from "ts-essentials";
import { generateUniqueTargetKey } from "../common/utils";
import { createContentSubject } from "../stream";
import {
  AmbiguousGenericResponse,
  AmbiguousLeaf,
  ContentObservable,
  ContentObserver,
  ErrorLeafConfig,
  LeafError,
  NextContentObserver,
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

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 */
export async function createLeaf(
  fn: (
    observer: NextContentObserver<
      Omit<AmbiguousGenericResponse, "originalRequest">,
      NextResult
    >
  ) => AsyncOrSync<Omit<AmbiguousLeaf, "subscribe">>
): Promise<AmbiguousLeaf> {
  let originalRequests: Record<
    ReturnType<typeof generateUniqueTargetKey>,
    AmbiguousGenericResponse["originalRequest"]
  > = {};

  const baseSubject = createContentSubject<
    AmbiguousGenericResponse,
    NextResult
  >((...nextOutputs) => {
    return nextOutputs.every((nextOutput) => nextOutput === NextResult.BREAK)
      ? NextResult.BREAK
      : NextResult.FALLTHROUGH;
  });

  const subject: typeof baseSubject = {
    ...baseSubject,
    next: (response) => {
      return baseSubject.next({
        ...response,
        originalRequest: originalRequests[generateUniqueTargetKey(response)],
      });
    },
  };

  const baseLeaf = await Promise.resolve(fn(subject));

  return {
    next: (request) => {
      originalRequests[generateUniqueTargetKey(request)] = request;

      return (async () => {
        try {
          return await Promise.resolve(baseLeaf.next(request));
        } catch (error) {
          (error as LeafError).currentLeafName = request.currentLeafName;
          throw error;
        }
      })();
    },
    subscribe: (observer) => {
      return baseSubject.subscribe(observer);
    },
  };
}

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
