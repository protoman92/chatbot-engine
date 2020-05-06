import { createCompositeSubscription } from "../../stream";
import { ErrorContext } from "../../type/common";
import { AmbiguousLeaf, LeafTransformer } from "../../type/leaf";

/** If a leaf throws error while producing content, switch to fallback leaf */
export function catchError<Context>(
  fallbackLeaf: AmbiguousLeaf<Context & ErrorContext>
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    next: async ({ oldContext, ...request }) => {
      try {
        return await leaf.next({ ...request, oldContext });
      } catch (error) {
        return fallbackLeaf.next({
          ...request,
          oldContext: { ...oldContext, error },
        });
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
