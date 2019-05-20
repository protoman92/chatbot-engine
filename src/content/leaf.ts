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
export function createLeafWithObserver<C>(
  fn: (
    observer: Pick<ContentObserver<GenericResponse<C>>, 'next'>
  ) => Omit<Leaf<C>, 'subscribe'>
): Leaf<C> {
  const subject = createContentSubject<GenericResponse<C>>();
  const baseLeaf = fn(subject);

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
): Leaf<C & ErrorContext> {
  return createLeafWithObserver(observer => ({
    next: async ({ senderID, senderPlatform, error }) => {
      !!fn && (await fn(error));

      return observer.next({
        senderID,
        senderPlatform,
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
