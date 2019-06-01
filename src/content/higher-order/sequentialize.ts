import { mapSeries, toPromise } from '../../common/utils';
import { PromiseConvertible } from '../../type/common';
import { Leaf } from '../../type/leaf';
import { createLeafFromAllLeaves } from '../leaf';

/**
 * Produce output from a sequence of leaves after the current leaf is done.
 * @template C The original input type.
 */
export function thenInvokeAll<C>(
  ...leaves: readonly PromiseConvertible<Leaf<C>>[]
): Leaf.Transformer<C, C> {
  return async leaf =>
    (async (): Promise<Leaf<C>> => {
      const allLeaves = [leaf, ...(await mapSeries(leaves, l => toPromise(l)))];
      return createLeafFromAllLeaves(...allLeaves);
    })();
}
