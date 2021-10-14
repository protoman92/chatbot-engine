import { requireNotNull } from "../common/utils";
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
export async function createLeaf<Context>(
  fn: (
    observer: NextContentObserver<
      Omit<AmbiguousGenericResponse<Context>, "originalRequest">
    >
  ) => Promise<Omit<AmbiguousLeaf<Context>, "subscribe">>
): Promise<AmbiguousLeaf<Context>> {
  let originalRequest: AmbiguousGenericResponse<Context>["originalRequest"];
  const baseSubject = createContentSubject<AmbiguousGenericResponse<Context>>();

  const subject: typeof baseSubject = {
    ...baseSubject,
    next: async (response) => {
      return baseSubject.next({
        ...response,
        originalRequest,
      } as AmbiguousGenericResponse<Context>);
    },
  };

  const baseLeaf = await fn(subject);

  return {
    next: async (request) => {
      originalRequest = request;

      try {
        const result = await baseLeaf.next(request);
        return result;
      } catch (error) {
        (error as LeafError).currentLeafName = request.currentLeafName;
        throw error;
      }
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
export function createDefaultErrorLeaf<Context>({
  formatErrorMessage,
  trackError,
}: ErrorLeafConfig): Promise<AmbiguousLeaf<Context>> {
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
export async function createLeafObserver<Context>({
  facebook,
  telegram,
}: Readonly<{
  facebook?: FacebookLeafObserver<Context>;
  telegram?: TelegramLeafObserver<Context>;
}>): Promise<AmbiguousLeafObserver<Context>> {
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
