import { isType } from "@haipham/javascript-helper-preconditions";
import { omitProperties } from "../common/utils";
import { createCompositeSubscription } from "../stream";
import { AmbiguousLeaf, LeafError, LeafTransformer } from "../type";

/** If a leaf throws error while producing content, switch to fallback leaf */
export function catchError(fallbackLeaf: AmbiguousLeaf): LeafTransformer {
  return (leaf) => ({
    next: async (request) => {
      try {
        return await leaf.next(request);
      } catch (error) {
        let erroredLeaf = request.currentLeafName;

        if (
          isType<LeafError>(error, "currentLeafName") &&
          typeof error.currentLeafName === "string"
        ) {
          erroredLeaf = error.currentLeafName;
        }

        return fallbackLeaf.next({
          ...omitProperties(request, "input", "rawRequest", "triggerType"),
          input: { erroredLeaf, error: error as Error, type: "error" },
          originalRequest: request,
          triggerType: "manual",
        });
      }
    },
    subscribe: async (observer) => {
      return createCompositeSubscription(
        await leaf.subscribe(observer),
        await fallbackLeaf.subscribe(observer)
      );
    },
  });
}
