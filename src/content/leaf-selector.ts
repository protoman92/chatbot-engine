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
import { enumerateLeafPipelineInputs } from './leaf-pipeline';

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
  const pipelineInputs = enumerateLeafPipelineInputs(allBranches);
  const errorLeaf: Leaf<C> = createDefaultErrorLeaf();
  let outputObservable: ContentObservable<GenericResponse<C>>;

  const selector = {
    enumerateInputs: async () => pipelineInputs,
    getErrorLeaf: async () => errorLeaf,
    /**
     * Clear previously active branch if current active branch differs.
     * @param pipelineInputs All available pipeline inputs.
     * @param newContext The new context object.
     * @param previousActiveBranch The previously active branch.
     * @return A Promise of context object.
     */
    clearPreviouslyActiveBranch: async (
      pipelineInputs: readonly LeafPipeline.Input<C>[],
      newContext: C,
      previousActiveBranch?: string
    ): Promise<C> => {
      const { activeBranch } = newContext;

      if (!!previousActiveBranch && activeBranch !== previousActiveBranch) {
        const pipelineInput = pipelineInputs.find(
          ({ prefixLeafPaths, currentLeafID }) => {
            return (
              joinPaths(...prefixLeafPaths, currentLeafID) ===
              previousActiveBranch
            );
          }
        );

        if (!!pipelineInput && !!pipelineInput.parentBranch.contextKeys) {
          const contextKeys = pipelineInput.parentBranch.contextKeys;
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
      const pipelineInputs = await selector.enumerateInputs();

      try {
        for (const pipelineInput of pipelineInputs) {
          const oldContext = deepClone(originalContext);

          const nextResult = await leafPipeline.next({
            senderID,
            pipelineInput,
            additionalParams: { oldContext, inputText }
          });

          if (nextResult !== STREAM_INVALID_NEXT_RESULT) return nextResult;
        }
      } catch ({ message }) {
        const errorLeaf = await selector.getErrorLeaf();

        return leafPipeline.next({
          senderID,
          pipelineInput: {
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
      const pipelineInputs = await selector.enumerateInputs();

      return mapSeries(pipelineInputs, async ({ currentLeaf }) => {
        return !!currentLeaf.complete && currentLeaf.complete();
      });
    },
    subscribe: async (observer: ContentObserver<GenericResponse<C>>) => {
      if (!outputObservable) {
        const pipelineInputs = await selector.enumerateInputs();

        outputObservable = mergeObservables(
          ...pipelineInputs.map(({ currentLeaf }) => currentLeaf),
          errorLeaf
        );
      }

      return outputObservable.subscribe(observer);
    }
  };

  return selector;
}
