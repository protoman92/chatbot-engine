import {
  deepClone,
  formatSpecialKey,
  joinPaths,
  mapSeries
} from '../common/utils';
import { mergeObservables, STREAM_INVALID_NEXT_RESULT } from '../stream/stream';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { Leaf } from '../type/leaf';
import { LeafPipeline } from '../type/leaf-pipeline';
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
export function enumerateLeaves<C extends Context>(
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
 * @param leafPipeline A leaf pipeline instance capable of processing leaves.
 * @param allBranches All available branches.
 * @return A leaf selector instance.
 */
export function createLeafSelector<C extends Context>(
  leafPipeline: LeafPipeline<C>,
  allBranches: KV<Branch<C>>
) {
  const enumeratedLeaves = enumerateLeaves(allBranches);
  const errorLeaf: Leaf<C> = createDefaultErrorLeaf();
  let outputObservable: ContentObservable<GenericResponse<C>>;

  const selector = {
    enumerateLeaves: async () => enumeratedLeaves,
    getErrorLeaf: async () => errorLeaf,
    /**
     * Clear previously active branch if current active branch differs.
     * @param enumeratedLeaves All available enumerated leaves.
     * @param newContext The new context object.
     * @param previousActiveBranch The previously active branch.
     * @return A Promise of context object.
     */
    clearPreviouslyActiveBranch: async (
      enumeratedLeaves: readonly LeafSelector.EnumeratedLeaf<C>[],
      newContext: C,
      previousActiveBranch?: string
    ): Promise<C> => {
      const { activeBranch } = newContext;

      if (!!previousActiveBranch && activeBranch !== previousActiveBranch) {
        const enumeratedLeaf = enumeratedLeaves.find(
          ({ prefixLeafPaths, currentLeafID }) => {
            return (
              joinPaths(...prefixLeafPaths, currentLeafID) ===
              previousActiveBranch
            );
          }
        );

        if (!!enumeratedLeaf && !!enumeratedLeaf.parentBranch.contextKeys) {
          const contextKeys = enumeratedLeaf.parentBranch.contextKeys;
          contextKeys.forEach(key => delete newContext[key]);
        }
      }

      return newContext;
    },

    next: async ({
      senderID,
      oldContext: originalContext,
      inputText
    }: LeafSelector.Input<C>): Promise<NextResult> => {
      try {
        const enumeratedLeaves = await selector.enumerateLeaves();

        for (const enumeratedLeaf of enumeratedLeaves) {
          const oldContext = deepClone(originalContext);

          const nextResult = await leafPipeline.next({
            senderID,
            enumeratedLeaf,
            additionalParams: { oldContext, inputText }
          });

          if (nextResult !== STREAM_INVALID_NEXT_RESULT) return nextResult;
        }

        throw new Error('This bot has nothing to say');
      } catch ({ message }) {
        const errorLeaf = await selector.getErrorLeaf();

        return leafPipeline.next({
          senderID,
          enumeratedLeaf: {
            currentLeaf: errorLeaf,
            currentLeafID: ERROR_LEAF_ID,
            parentBranch: {},
            prefixLeafPaths: []
          },
          additionalParams: {
            oldContext: deepClone(originalContext),
            inputText: message || inputText
          }
        });
      }

      return STREAM_INVALID_NEXT_RESULT;
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
