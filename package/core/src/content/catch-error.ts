import { isType } from "@haipham/javascript-helper-preconditions";
import { omitProperties } from "../common/utils";
import { createCompositeSubscription } from "../stream";
import { AmbiguousLeaf, LeafError, LeafTransformer } from "../type";

/** If a leaf throws error while producing content, switch to fallback leaf */
export function catchError(fallbackLeaf: AmbiguousLeaf): LeafTransformer {
  return (leaf) => ({
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
          ...omitProperties(request, "input", "rawRequest", "triggerType"),
          currentLeafName,
          input: { erroredLeaf, error: error as Error, type: "error" },
          triggerType: "manual",
        });
      }
    },
    subscribe: async (observer) => {
      return createCompositeSubscription(
        await Promise.resolve(leaf.subscribe(observer)),
        await Promise.resolve(fallbackLeaf.subscribe(observer))
      );
    },
  });
}
