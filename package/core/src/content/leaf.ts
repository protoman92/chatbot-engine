import { requireNotNull } from "@haipham/javascript-helper-utils";
import { generateUniqueTargetKey } from "../common/utils";
import { createContentSubject, NextResult } from "../stream";
import {
  AmbiguousGenericResponse,
  AmbiguousLeaf,
  AmbiguousLeafObserver,
  ErrorLeafConfig,
  FacebookLeafObserver,
  LeafError,
  NextContentObserver,
  TelegramLeafObserver,
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
  ) => Promise<Omit<AmbiguousLeaf, "subscribe">>
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
      } as AmbiguousGenericResponse);
    },
  };

  const baseLeaf = await fn(subject);

  return {
    next: (request) => {
      originalRequests[generateUniqueTargetKey(request)] = request;

      return baseLeaf.next(request).catch((error) => {
        (error as LeafError).currentLeafName = request.currentLeafName;
        throw error;
      });
    },
    complete: async () => {
      !!baseLeaf.complete && (await baseLeaf.complete());
      await baseSubject.complete();
    },
    subscribe: (observer) => baseSubject.subscribe(observer),
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
  return createLeaf(async (observer) => ({
    next: async ({ input, targetID, targetPlatform, ...request }) => {
      if (input.type !== "error") return NextResult.FALLTHROUGH;
      const { error, erroredLeaf } = input;

      if (trackError != null) {
        trackError({ error, erroredLeaf, targetID, targetPlatform });
      }

      return observer.next({
        targetID,
        targetPlatform,
        output: [
          {
            content: {
              type: "text",
              text: formatErrorMessage(error),
            },
          },
        ],
      });
    },
  }));
}

/**
 * Create a leaf observer that handles content for different platforms, based
 * on the leaf input.
 */
export async function createLeafObserver({
  facebook,
  telegram,
}: Readonly<{
  facebook?: FacebookLeafObserver;
  telegram?: TelegramLeafObserver;
}>): Promise<AmbiguousLeafObserver> {
  return {
    next: async (request) => {
      switch (request.targetPlatform) {
        case "facebook":
          return requireNotNull(facebook).next(request);

        case "telegram":
          return requireNotNull(telegram).next(request);
      }
    },
    complete: async () => {
      !!facebook && !!facebook.complete && (await facebook.complete());
      !!telegram && !!telegram.complete && (await telegram.complete());
    },
  };
}
