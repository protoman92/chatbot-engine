import { createCompositeSubscription } from "../../stream/stream";
import { ErrorContext } from "../../type/common";
import { Leaf } from "../../type/leaf";

/**
 * If a leaf throws error while producing content, switch to fallback leaf.
 * @template C The original input type.
 */
export function higherOrderCatchError<C>(
  fallbackLeaf: Leaf<C & ErrorContext>
): Leaf.Transformer<C, C> {
  return async leaf => ({
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
