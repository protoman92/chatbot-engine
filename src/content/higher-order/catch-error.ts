import { createCompositeSubscription } from "../../stream";
import { AmbiguousLeaf, LeafTransformer } from "../../type/leaf";

/** If a leaf throws error while producing content, switch to fallback leaf */
export function catchError<Context>(
  fallbackLeaf: AmbiguousLeaf<Context>
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    next: async ({ currentLeafName, input, ...request }) => {
      try {
        return await leaf.next({ ...request, currentLeafName, input });
      } catch (error) {
        let erroredLeaf = currentLeafName;

        if (
          "currentLeafName" in error &&
          typeof error.currentLeafName === "string"
        ) {
          erroredLeaf = error.currentLeafName;
        }

        return fallbackLeaf.next({
          ...request,
          currentLeafName,
          input: { error, erroredLeaf },
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
