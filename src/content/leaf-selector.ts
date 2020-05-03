import { deepClone, mapSeries } from "../common/utils";
import { mergeObservables } from "../stream";
import { Branch } from "../type/branch";
import { DefaultContext, KV } from "../type/common";
import { LeafEnumeration } from "../type/leaf";
import { AmbiguousResponse } from "../type/response";
import { ContentObservable, ContentObserver, NextResult } from "../type/stream";

/**
 * Enumerate a key-value branch object to produce the entire list of enumerated
 * leaves.  Each enumerated leaf will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 */
export function enumerateLeaves<Context>(
  branches: KV<Branch<Context>>
): readonly LeafEnumeration<Context>[] {
  function enumerate(
    allBranches: KV<Branch<Context>>,
    prefixPaths?: readonly string[]
  ): readonly LeafEnumeration<Context>[] {
    let inputs: LeafEnumeration<Context>[] = [];
    const branchEntries = Object.entries(allBranches);

    for (const [branchID, parentBranch] of branchEntries) {
      if (!parentBranch) continue;
      const prefixLeafPaths = [...(prefixPaths || []), branchID];
      const { subBranches, leaves } = parentBranch;

      if (leaves !== undefined && leaves !== null) {
        const leafEntries = Object.entries(leaves);

        for (const [currentLeafID, currentLeaf] of leafEntries) {
          if (!currentLeaf) continue;
          inputs.push({
            parentBranch,
            currentLeaf,
            currentLeafID,
            prefixLeafPaths,
          });
        }
      }

      if (subBranches !== undefined && subBranches !== null) {
        inputs = inputs.concat(enumerate(subBranches, prefixLeafPaths));
      }
    }

    return inputs;
  }

  return enumerate(branches);
}

/**
 * Create a leaf selector. A leaf selector is a leaf that chooses the most
 * appropriate leaf out of all available leaves, based on the user's input.
 * Said leaf's content will be delivered to the user.
 */
export function createLeafSelector<Context>(allBranches: KV<Branch<Context>>) {
  const enumeratedLeaves = enumerateLeaves(allBranches);
  let outputObservable: ContentObservable<AmbiguousResponse<Context>>;

  const selector = {
    enumerateLeaves: async () => enumeratedLeaves,

    /**
     * Trigger the production of content for a leaf, but does not guarantee
     * its success.
     */
    triggerLeafContent: (
      { currentLeaf }: LeafEnumeration<Context>,
      input: Context & DefaultContext
    ) => {
      return currentLeaf.next(input);
    },
    next: async (input: Context & DefaultContext): Promise<NextResult> => {
      const enumeratedLeaves = await selector.enumerateLeaves();

      for (const enumeratedLeaf of enumeratedLeaves) {
        const clonedInput = deepClone(input);

        const nextResult = await selector.triggerLeafContent(
          enumeratedLeaf,
          clonedInput
        );

        if (nextResult !== undefined) return nextResult;
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
