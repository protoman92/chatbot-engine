import { Omit } from 'ts-essentials';
import { createContentSubject } from '../stream/stream';
import { ErrorContext } from '../type/common';
import { Leaf } from '../type/leaf';
import { GenericResponse } from '../type/response';
import { ContentObserver } from '../type/stream';

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
