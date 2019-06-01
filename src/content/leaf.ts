import { Omit } from 'ts-essentials';
import { mapSeries, toPromise } from '../common/utils';
import {
  createCompositeSubscription,
  createContentSubject
} from '../stream/stream';
import { ErrorContext, PromiseConvertible } from '../type/common';
import { Facebook } from '../type/facebook';
import { Leaf } from '../type/leaf';
import { GenericResponse } from '../type/response';
import { ContentObserver, NextResult } from '../type/stream';
import { Telegram } from '../type/telegram';

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 * @template C The context used by the current chatbot.
 */
export async function createLeafWithObserver<C>(
  fn: (
    observer: Pick<ContentObserver<GenericResponse<C>>, 'next'>
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
 * Create a leaf that handles content for different platforms, based on the
 * leaf input.
 * @template C The context used by the current chatbot.
 */
export function createLeafForPlatforms<C>(
  fn: (
    observer: Pick<ContentObserver<GenericResponse<C>>, 'next'>
  ) => Promise<
    Readonly<{
      facebook: Omit<Facebook.Leaf<C>, 'subscribe'>;
      telegram: Omit<Telegram.Leaf<C>, 'subscribe'>;
    }>
  >
): Promise<Leaf<C>> {
  return createLeafWithObserver(async observer => {
    const { facebook, telegram } = await fn(observer);

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
  });
}

/** If anyLeaf is false,
 */
async function createBaseLeafFromLeaves<C>(
  anyLeaf: boolean,
  ...leaves: readonly PromiseConvertible<Leaf<C>>[]
): Promise<Leaf<C>> {
  const allLeaves = await mapSeries(leaves, toPromise);

  return {
    next: async input => {
      let result: NextResult = undefined;

      for (const nextLeaf of allLeaves) {
        result = await nextLeaf.next(input);

        if (result === undefined || result === null) {
          if (!!anyLeaf) continue;
          else return result;
        } else if (!!anyLeaf) return result;
      }

      return result;
    },
    complete: async () => {
      return mapSeries(allLeaves, async l => !!l.complete && l.complete());
    },
    subscribe: async handlers => {
      return createCompositeSubscription(
        ...(await mapSeries(allLeaves, l => l.subscribe(handlers)))
      );
    }
  };
}

/**
 * Create a leaf from a sequence of leaves, but only when all leaves are valid.
 * @template C The original context type.
 */
export function createLeafFromAllLeaves<C>(
  ...leaves: readonly PromiseConvertible<Leaf<C>>[]
) {
  return createBaseLeafFromLeaves(false, ...leaves);
}

/**
 * Create a leaf from a sequence of leaves, but stop at the first leaf that is
 * value.
 * @template C The original context type.
 */
export function createLeafFromAnyLeaf<C>(
  ...leaves: readonly PromiseConvertible<Leaf<C>>[]
) {
  return createBaseLeafFromLeaves(true, ...leaves);
}
