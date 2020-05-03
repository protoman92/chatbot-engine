import { createCompositeSubscription } from "../../stream";
import { ErrorContext } from "../../type/common";
import { AmbiguousLeaf, LeafTransformer } from "../../type/leaf";

/**
 * If a leaf throws error while producing content, switch to fallback leaf.
 * @template C The original input type.
 */
export function catchError<C>(
  fallbackLeaf: AmbiguousLeaf<C & ErrorContext>
): LeafTransformer<C, C> {
  return async (leaf) => ({
    next: async (input) => {
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
    subscribe: async (observer) => {
      return createCompositeSubscription(
        await leaf.subscribe(observer),
        await fallbackLeaf.subscribe(observer)
      );
    },
  });
}
