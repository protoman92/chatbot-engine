import { Omit } from "ts-essentials";
import { genericError } from "../common/utils";
import { createContentSubject } from "../stream";
import { ErrorContext } from "../type/common";
import { FacebookLeafObserver } from "../type/facebook";
import { AmbiguousLeaf, AmbiguousLeafObserver } from "../type/leaf";
import { AmbiguousResponse } from "../type/response";
import { NextContentObserver } from "../type/stream";
import { TelegramLeafObserver } from "../type/telegram";

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 */
export async function createLeafWithObserver<Context = {}>(
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
      return baseLeaf.next(request);
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
export function createDefaultErrorLeaf<Context = {}>(
  fn?: (e: Error) => Promise<unknown>
): Promise<AmbiguousLeaf<Context & ErrorContext>> {
  return createLeafWithObserver(async (observer) => ({
    next: async ({ oldContext: { error }, ...request }) => {
      !!fn && (await fn(error));

      return observer.next({
        ...request,
        targetPlatform: request.targetPlatform,
        output: [
          {
            content: {
              type: "text",
              text: `Encountered an error: '${error.message}'`,
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
export async function createLeafObserverForPlatforms<Context = {}>({
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
          if (!facebook) break;
          return facebook.next(request);

        case "telegram":
          if (!telegram) break;
          return telegram.next(request);
      }

      throw genericError(`Unhandled platform ${request.targetPlatform}`);
    },
    complete: async () => {
      !!facebook && !!facebook.complete && (await facebook.complete());
      !!telegram && !!telegram.complete && (await telegram.complete());
    },
  };
}
