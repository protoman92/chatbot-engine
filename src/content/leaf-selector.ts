import { isType, mapSeries } from "../common/utils";
import { mergeObservables, NextResult } from "../stream";
import { Branch } from "../type/branch";
import { AmbiguousLeaf, LeafEnumeration, LeafSelector } from "../type/leaf";
import { AmbiguousResponse } from "../type/response";
import { ContentObservable, ContentObserver } from "../type/stream";

/**
 * Enumerate a key-value branch object to produce the entire list of enumerated
 * leaves.  Each enumerated leaf will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 */
export function enumerateLeaves<Context>(
  branch: Branch<Context>
): readonly LeafEnumeration<Context>[] {
  function enumerate(
    branch: Branch<Context>,
    prefixPaths?: readonly string[]
  ): readonly LeafEnumeration<Context>[] {
    let inputs: LeafEnumeration<Context>[] = [];

    for (const [leafOrBranchID, leafOrBranch] of Object.entries(branch)) {
      const prefixLeafPaths = [...(prefixPaths || []), leafOrBranchID];

      if (isType<AmbiguousLeaf<Context>>(leafOrBranch, "next", "subscribe")) {
        inputs.push({
          parentBranch: branch,
          currentLeaf: leafOrBranch,
          currentLeafName: leafOrBranchID,
          prefixLeafPaths,
        });
      } else {
        inputs = inputs.concat(enumerate(leafOrBranch, prefixLeafPaths));
      }
    }

    return inputs;
  }

  return enumerate(branch);
}

/**
 * Create a leaf selector. A leaf selector is a leaf that chooses the most
 * appropriate leaf out of all available leaves, based on the user's input.
 * Said leaf's content will be delivered to the user.
 */
export function createLeafSelector<Context>(branch: Branch<Context>) {
  const _enumeratedLeaves = enumerateLeaves(branch);
  let outputObservable: ContentObservable<AmbiguousResponse<Context>>;
  let _subscribeCount = 0;

  const selector = {
    enumerateLeaves: async () => _enumeratedLeaves,
    subscribeCount: () => _subscribeCount,
    /**
     * Trigger the production of content for a leaf, but does not guarantee
     * its success.
     */
    triggerLeaf: (
      { currentLeafName, currentLeaf }: LeafEnumeration<Context>,
      request: Parameters<LeafSelector<Context>["next"]>[0]
    ) => {
      return currentLeaf.next({ ...request, currentLeafName });
    },
    next: async (request: Parameters<LeafSelector<Context>["next"]>[0]) => {
      const enumeratedLeaves = await selector.enumerateLeaves();

      for (const enumLeaf of enumeratedLeaves) {
        const nextResult = await selector.triggerLeaf(enumLeaf, request);

        switch (nextResult) {
          case NextResult.BREAK:
            return nextResult;

          case NextResult.FALLTHROUGH:
            break;
        }
      }

      throw new Error("This bot has nothing to say");
    },
    complete: async () => {
      const enumeratedLeaves = await selector.enumerateLeaves();

      return mapSeries(enumeratedLeaves, async ({ currentLeaf }) => {
        return !!currentLeaf.complete && currentLeaf.complete();
      });
    },
    subscribe: async (
      observer: ContentObserver<AmbiguousResponse<Context>>
    ) => {
      _subscribeCount += 1;

      if (selector.subscribeCount() > 1) {
        throw new Error(
          "Please do not subscribe to leaf selectors multiple times. " +
            "Create another one to avoid unepxected behaviours."
        );
      }

      if (!outputObservable) {
        const enumeratedLeaves = await selector.enumerateLeaves();

        outputObservable = mergeObservables(
          ...enumeratedLeaves.map(({ currentLeaf }) => currentLeaf)
        );
      }

      return outputObservable.subscribe(observer);
    },
  };

  return selector;
}
