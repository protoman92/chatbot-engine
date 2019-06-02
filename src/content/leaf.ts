import { Omit } from 'ts-essentials';
import { createContentSubject } from '../stream/stream';
import { ErrorContext } from '../type/common';
import { Leaf } from '../type/leaf';
import { GenericResponse } from '../type/response';
import { NextContentObserver } from '../type/stream';

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 * @template C The context used by the current chatbot.
 */
export async function createLeafWithObserver<C>(
  fn: (
    observer: NextContentObserver<GenericResponse<C>>
  ) => Promise<Omit<Leaf<C>, 'subscribe'>>
): Promise<Leaf<C>> {
  const subject = createContentSubject<GenericResponse<C>>();
  const baseLeaf = await fn(subject);

  return {
    ...baseLeaf,
    complete: async () => {
      !!baseLeaf.complete && (await baseLeaf.complete());
      await subject.complete();
    },
    subscribe: observer => subject.subscribe(observer)
  };
}

/**
 * Create an error leaf that will be used to deliver error messages if no
 * other leaf can handle the error.
 * @template C The context used by the current chatbot.
 */
export function createDefaultErrorLeaf<C>(
  fn?: (e: Error) => Promise<unknown>
): Promise<Leaf<C & ErrorContext>> {
  return createLeafWithObserver(async observer => ({
    next: async ({ error, ...restInput }) => {
      !!fn && (await fn(error));

      return observer.next({
        ...restInput,
        targetPlatform: restInput.targetPlatform,
        visualContents: [
          {
            content: {
              type: 'text',
              text: `Encountered an error: '${error.message}'`
            }
          }
        ]
      });
    }
  }));
}

/**
 * Create a leaf observer that handles content for different platforms, based
 * on the leaf input.
 * @template C The context used by the current chatbot.
 */
export async function createLeafObserverForPlatforms<C>({
  facebook,
  telegram
}: Leaf.Platform.Observer<C>): Promise<Leaf.Observer<C>> {
  return {
    next: async input => {
      switch (input.targetPlatform) {
        case 'facebook':
          return facebook.next(input);

        case 'telegram':
          return telegram.next(input);
      }
    },
    complete: async () => {
      !!facebook.complete && (await facebook.complete());
      !!telegram.complete && (await telegram.complete());
    }
  };
}

/**
 * Create an observer chain from multiple observers.
 * @template C The context used by the current chatbot.
 */
export function createObserverChain<C>(): Leaf.ObserverChain<C> {
  let currentObserver: Leaf.Observer<C> = { next: async () => ({}) };

  const observerChain: Leaf.ObserverChain<C> = {
    and: observer => {
      const oldObserver = currentObserver;

      currentObserver = {
        next: async input => {
          const result = await oldObserver.next(input);
          if (result === undefined || result === null) return result;
          return observer.next(input);
        },
        complete: async () => {
          !!oldObserver.complete && (await oldObserver.complete());
          !!observer.complete && (await observer.complete());
        }
      };

      return observerChain;
    },
    andNext: next => observerChain.and({ next }),
    or: observer => {
      const oldObserver = currentObserver;

      currentObserver = {
        next: async input => {
          const result = await oldObserver.next(input);
          if (result !== undefined && result !== null) return result;
          return observer.next(input);
        },
        complete: async () => {
          !!oldObserver.complete && (await oldObserver.complete());
          !!observer.complete && (await observer.complete());
        }
      };

      return observerChain;
    },
    orNext: next => observerChain.or({ next }),
    toObserver: () => currentObserver
  };

  return observerChain;
}
