import { AsyncOrSync } from "ts-essentials";
import { generateUniqueTargetKey } from "../common/utils";
import { createContentSubject, NextResult } from "../stream";
import {
  AmbiguousGenericResponse,
  AmbiguousLeaf,
  ErrorLeafConfig,
  LeafError,
  NextContentObserver,
} from "../type";

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 */
export async function createLeaf(
  fn: (
    observer: NextContentObserver<
      Omit<AmbiguousGenericResponse, "originalRequest">
    >
  ) => AsyncOrSync<Omit<AmbiguousLeaf, "subscribe">>
): Promise<AmbiguousLeaf> {
  let originalRequests: Record<
    ReturnType<typeof generateUniqueTargetKey>,
    AmbiguousGenericResponse["originalRequest"]
  > = {};

  const baseSubject = createContentSubject<AmbiguousGenericResponse>();

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
    complete: async () => {
      await baseLeaf.complete?.call(undefined);
      await baseSubject.complete?.call(undefined);
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
