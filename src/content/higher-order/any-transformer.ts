import { mapSeries } from '../../common/utils';
import { createCompositeSubscription } from '../../stream/stream';
import { Leaf } from '../../type/leaf';

/**
 * Run through a sequence of transformers and stop whenever a valid result is
 * returned. Discard all other transformers.
 * @template CI The original input type.
 * @template CO The target input type.
 */
export function higherOrderAnyTransformer<CI, CO extends CI>(
  ...transformers: readonly Leaf.Transformer<CI, CO>[]
): Leaf.Transformer<CI, CO> {
  return async leaf =>
    (async (): Promise<Leaf<CO>> => {
      const transformed = await mapSeries(transformers, tf => tf(leaf));

      return {
        next: async input => {
          for (const tfLeaf of transformed) {
            const result = await tfLeaf.next(input);
            if (result !== undefined) return result;
          }

          return undefined;
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
