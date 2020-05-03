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
 * @template C The context used by the current chatbot.
 */
export async function createLeafWithObserver<C = {}>(
  fn: (
    observer: NextContentObserver<AmbiguousResponse<C>>
  ) => Promise<Omit<AmbiguousLeaf<C>, "subscribe">>
): Promise<AmbiguousLeaf<C>> {
  const subject = createContentSubject<AmbiguousResponse<C>>();
  const baseLeaf = await fn(subject);

  return {
    ...baseLeaf,
    complete: async () => {
      !!baseLeaf.complete && (await baseLeaf.complete());
      await subject.complete();
    },
    subscribe: (observer) => subject.subscribe(observer),
  };
}

/**
 * Create an error leaf that will be used to deliver error messages if no
 * other leaf can handle the error.
 * @template C The context used by the current chatbot.
 */
export function createDefaultErrorLeaf<C = {}>(
  fn?: (e: Error) => Promise<unknown>
): Promise<AmbiguousLeaf<C & ErrorContext>> {
  return createLeafWithObserver(async (observer) => ({
    next: async ({ error, ...restInput }) => {
      !!fn && (await fn(error));

      return observer.next({
        ...restInput,
        targetPlatform: restInput.targetPlatform,
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
    next: async (input) => {
      switch (input.targetPlatform) {
        case "facebook":
          if (!facebook) break;
          return facebook.next(input);

        case "telegram":
          if (!telegram) break;
          return telegram.next(input);
      }

      throw genericError(`Unhandled platform ${input.targetPlatform}`);
    },
    complete: async () => {
      !!facebook && !!facebook.complete && (await facebook.complete());
      !!telegram && !!telegram.complete && (await telegram.complete());
    },
  };
}
