import { createCompositeSubscription } from '../../stream/stream';
import { ErrorContext } from '../../type/common';
import { Leaf } from '../../type/leaf';

/**
 * If a leaf throws error while trying to produce content, switch to a fallback
 * leaf.
 * @template C The input context type/
 * @param fallbackLeaf The fallback leaf.
 * @return A leaf transformer.
 */
export function catchErrorJustFallback<C>(
  fallbackLeaf: Leaf<C & ErrorContext>
): Leaf.Transformer<C, C> {
  return leaf => ({
    next: async input => {
      try {
        return await leaf.next(input);
      } catch (error) {
        return fallbackLeaf.next({ ...input, error });
      }
    },
    complete: async () => {
      !!leaf.complete && (await leaf.complete());
      !!fallbackLeaf.complete && (await fallbackLeaf.complete());
    },
    subscribe: async observer => {
      return createCompositeSubscription(
        await leaf.subscribe(observer),
        await fallbackLeaf.subscribe(observer)
      );
    }
  });
}
