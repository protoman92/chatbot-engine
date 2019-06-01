import { createCompositeSubscription } from '../../stream/stream';
import { PromiseConvertible } from '../../type/common';
import { Leaf } from '../../type/leaf';
import { GenericResponse } from '../../type/response';
import { NextContentObserver } from '../../type/stream';
import { createLeafFromAllLeaves } from '../leaf';

/**
 * Produce output from a sequence of leaves after the current leaf is done.
 * @template C The original input type.
 */
export function higherOrderThenInvokeAll<C>(
  fn: (
    observer: NextContentObserver<GenericResponse<C>>
  ) => Promise<readonly PromiseConvertible<Leaf.Observer<C>>[]>
): Leaf.Transformer<C, C> {
  return async leaf => {
    const concatenatedLeaf = await createLeafFromAllLeaves(
      async observer => await fn(observer)
    );

    return {
      next: async input => {
        const result = await leaf.next(input);
        if (result === undefined || result === null) return result;
        return concatenatedLeaf.next(input);
      },
      complete: async () => {
        !!leaf.complete && (await leaf.complete());
        !!concatenatedLeaf.complete && (await concatenatedLeaf.complete());
      },
      subscribe: async handlers => {
        return createCompositeSubscription(
          await leaf.subscribe(handlers),
          await concatenatedLeaf.subscribe(handlers)
        );
      }
    };
  };
}
