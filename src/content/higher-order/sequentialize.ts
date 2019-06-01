import { mapSeries, toPromise } from '../../common/utils';
import {
  createCompositeSubscription,
  STREAM_INVALID_NEXT_RESULT
} from '../../stream/stream';
import { PromiseConvertible } from '../../type/common';
import { Leaf } from '../../type/leaf';
import { NextResult } from '../../type/stream';

/**
 * Produce output from a sequence of leaves after the current leaf is done.
 * @template C The original input type.
 */
export function thenInvoke<C>(
  ...leaves: readonly PromiseConvertible<Leaf<C>>[]
): Leaf.Transformer<C, C> {
  return async leaf =>
    (async (): Promise<Leaf<C>> => {
      const allLeaves = [leaf, ...(await mapSeries(leaves, l => toPromise(l)))];

      return {
        next: async input => {
          let result: NextResult = {};

          for (const nextLeaf of allLeaves) {
            result = await nextLeaf.next(input);
            if (result === STREAM_INVALID_NEXT_RESULT) return result;
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
    })();
}
