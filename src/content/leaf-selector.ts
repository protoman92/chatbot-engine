import { deepClone, formatSpecialKey, mapSeries } from '../common/utils';
import { mergeObservables, STREAM_INVALID_NEXT_RESULT } from '../stream/stream';
import { Branch } from '../type/branch';
import { KV } from '../type/common';
import { Leaf } from '../type/leaf';
import { LeafSelector } from '../type/leaf-selector';
import { GenericResponse } from '../type/response';
import { ContentObservable, ContentObserver, NextResult } from '../type/stream';
import { createDefaultErrorLeaf } from './leaf';

/**
 * Enumerate a key-value branch object to produce the entire list of enumerated
 * leaves.  Each enumerated leaf will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 * @template C The context used by the current chatbot.
 * @param branches A key-value object of branches.
 * @return An Array of enumerated leaves.
 */
export function enumerateLeaves<C>(
  branches: KV<Branch<C>>
): readonly LeafSelector.EnumeratedLeaf<C>[] {
  function enumerate(
    allBranches: KV<Branch<C>>,
    prefixPaths?: readonly string[]
  ): readonly LeafSelector.EnumeratedLeaf<C>[] {
    let inputs: LeafSelector.EnumeratedLeaf<C>[] = [];
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
            prefixLeafPaths
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
 * Represents the ID of the error leaf. This is used when the selector could
 * not determine which leaf to select.
 */
export const ERROR_LEAF_ID = formatSpecialKey('error');

/**
 * Create a leaf selector.
 * @template C The context used by the current chatbot.
 * @param allBranches All available branches.
 * @return A leaf selector instance.
 */
export function createLeafSelector<C>(allBranches: KV<Branch<C>>) {
  const enumeratedLeaves = enumerateLeaves(allBranches);
  const errorLeaf: Leaf<C> = createDefaultErrorLeaf();
  let outputObservable: ContentObservable<GenericResponse<C>>;

  const selector = {
    enumerateLeaves: async () => enumeratedLeaves,
    getErrorLeaf: async () => errorLeaf,

    /**
     * Trigger the production of content for a leaf, but does not guarantee
     * its success.
     * @param param0 An enumerated leaf instance.
     * @param input A leaf input instance.
     * @return A Promise of some response.
     */
    triggerLeafContent: (
      { currentLeaf }: LeafSelector.EnumeratedLeaf<C>,
      input: Leaf.Input<C>
    ) => {
      return currentLeaf.next(input);
    },
    next: async ({
      senderID,
      oldContext: originalContext,
      ...restInput
    }: Leaf.Input<C>): Promise<NextResult> => {
      try {
        const enumeratedLeaves = await selector.enumerateLeaves();

        for (const enumeratedLeaf of enumeratedLeaves) {
          const oldContext = deepClone(originalContext);

          const nextResult = await selector.triggerLeafContent(enumeratedLeaf, {
            ...restInput,
            senderID,
            oldContext
          });

          if (nextResult !== STREAM_INVALID_NEXT_RESULT) return nextResult;
        }

        throw new Error('This bot has nothing to say');
      } catch ({ message }) {
        const errorLeaf = await selector.getErrorLeaf();

        return selector.triggerLeafContent(
          {
            currentLeaf: errorLeaf,
            currentLeafID: ERROR_LEAF_ID,
            parentBranch: {},
            prefixLeafPaths: []
          },
          {
            senderID,
            oldContext: deepClone(originalContext),
            inputText: message || restInput.inputText,
            inputImageURL: undefined,
            inputCoordinates: undefined
          }
        );
      }
    },
    complete: async () => {
      const enumeratedLeaves = await selector.enumerateLeaves();

      return mapSeries(enumeratedLeaves, async ({ currentLeaf }) => {
        return !!currentLeaf.complete && currentLeaf.complete();
      });
    },
    subscribe: async (observer: ContentObserver<GenericResponse<C>>) => {
      if (!outputObservable) {
        const enumeratedLeaves = await selector.enumerateLeaves();

        outputObservable = mergeObservables(
          ...enumeratedLeaves.map(({ currentLeaf }) => currentLeaf),
          errorLeaf
        );
      }

      return outputObservable.subscribe(observer);
    }
  };

  return selector;
}
