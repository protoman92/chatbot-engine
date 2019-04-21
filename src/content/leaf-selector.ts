import { deepClone, formatSpecialKey, joinPaths } from '../common/utils';
import { mergeObservables } from '../stream/stream';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';
import { GenericResponse } from '../type/messenger';
import { ContentObserver, ContentObservable } from '../type/stream';
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

  let outputObservable: ContentObservable<GenericResponse<C>>;

  const selector = {
    enumerateInputs: async () => pipelineInputs,
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
      text: inputText
    }: LeafSelector.Input<C>) => {
      const pipelineInputs = await selector.enumerateInputs();

      for (const pipelineInput of pipelineInputs) {
        const oldContext = deepClone(originalContext);

        const nextResult = await leafPipeline.next({
          senderID,
          pipelineInput,
          additionalParams: { oldContext, inputText }
        });

        if (nextResult !== null) return;
      }
    },
    complete: async () => {
      const pipelineInputs = await selector.enumerateInputs();

      return Promise.all(
        pipelineInputs.map(async ({ currentLeaf }) => {
          return !!currentLeaf.complete && currentLeaf.complete();
        })
      );
    },
    subscribe: async (observer: ContentObserver<GenericResponse<C>>) => {
      if (!outputObservable) {
        const pipelineInputs = await selector.enumerateInputs();

        outputObservable = mergeObservables(
          ...pipelineInputs.map(({ currentLeaf }) => currentLeaf)
        );
      }

      return outputObservable.subscribe(observer);
    }
  };

  return selector;
}
