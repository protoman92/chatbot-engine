import { requireNotNull } from "../common/utils";
import { createContentSubject, NextResult } from "../stream";
import { ErrorLeafConfig } from "../type";
import { FacebookLeafObserver } from "../type/facebook";
import { AmbiguousLeaf, AmbiguousLeafObserver } from "../type/leaf";
import { AmbiguousResponse } from "../type/response";
import { NextContentObserver } from "../type/stream";
import { TelegramLeafObserver } from "../type/telegram";

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 */
export async function createLeaf<Context>(
  fn: (
    observer: NextContentObserver<
      Omit<AmbiguousResponse<Context>, "originalRequest">
    >
  ) => Promise<Omit<AmbiguousLeaf<Context>, "subscribe">>
): Promise<AmbiguousLeaf<Context>> {
  let originalRequest: AmbiguousResponse<Context>["originalRequest"];
  const baseSubject = createContentSubject<AmbiguousResponse<Context>>();

  const subject: typeof baseSubject = {
    ...baseSubject,
    next: async (response) => {
      return baseSubject.next({
        ...response,
        originalRequest,
      } as AmbiguousResponse<Context>);
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
        error.currentLeafName = request.currentLeafName;
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
