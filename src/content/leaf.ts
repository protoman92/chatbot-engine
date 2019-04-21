import { Context } from '../type/common';
import { Leaf } from '../type/leaf';
import { Omit } from 'ts-essentials';
import { ContentSubject } from '../type/stream';
import { GenericResponse } from '../type/messenger';
import { createContentSubject } from '../stream/stream';

/**
 * Create a leaf from a base leaf with a default subject for broadcasting
 * contents.
 * @template C The context used by the current chatbot.
 * @param fn Function to create a base leaf using the supplied subject.
 * @return A leaf instance.
 */
export function createLeafWithSubject<C extends Context>(
  fn: (
    subject: ContentSubject<GenericResponse<C>>
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
