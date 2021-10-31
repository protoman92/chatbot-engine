import { isType } from "@haipham/javascript-helper-utils";
import { omitProperties } from "../common/utils";
import { createCompositeSubscription } from "../stream";
import { AmbiguousLeaf, LeafError, LeafTransformer } from "../type";

/** If a leaf throws error while producing content, switch to fallback leaf */
export function catchError<Context>(
  fallbackLeaf: AmbiguousLeaf<Context>
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    next: async ({ currentLeafName, ...request }) => {
      try {
        return await leaf.next({ ...request, currentLeafName });
      } catch (error) {
        let erroredLeaf = currentLeafName;

        if (
          isType<LeafError>(error, "currentLeafName") &&
          typeof error.currentLeafName === "string"
        ) {
          erroredLeaf = error.currentLeafName;
        }

        return fallbackLeaf.next({
          ...omitProperties(request, "input", "rawRequest", "type"),
          currentLeafName,
          input: { erroredLeaf, error: error as Error, type: "error" },
          type: "manual_trigger",
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
