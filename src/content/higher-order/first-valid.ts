import { mapSeries } from '../../common/utils';
import {
  createCompositeSubscription,
  STREAM_INVALID_NEXT_RESULT
} from '../../stream/stream';
import { Leaf } from '../../type/leaf';

export function firstValidResult<CI, CO extends CI>(
  ...transformers: readonly Leaf.Transformer<CI, CO>[]
): Leaf.Transformer<CI, CO> {
  return leaf =>
    ((): Leaf<CO> => {
      const transformed = transformers.map(tf => tf(leaf));

      return {
        next: async input => {
          for (const tfLeaf of transformed) {
            const result = await tfLeaf.next(input);
            if (result !== STREAM_INVALID_NEXT_RESULT) return result;
          }

          return STREAM_INVALID_NEXT_RESULT;
        },
        complete: () => {
          return mapSeries(
            transformed,
            async tfLeaf => !!tfLeaf.complete && tfLeaf.complete()
          );
        },
        subscribe: async handlers => {
          const subscriptions = await mapSeries(transformed, tfLeaf =>
            tfLeaf.subscribe(handlers)
          );

          return createCompositeSubscription(...subscriptions);
        }
      };
    })();
}
