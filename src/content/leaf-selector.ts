import { deepClone, formatSpecialKey, joinPaths } from '../common/utils';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';
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
  const selector = {
    enumerateInputs: async () => enumerateLeafPipelineInputs(allBranches),
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
    selectLeaf: async (originalContext: C, inputText: string) => {
      const pipelineInputs = await selector.enumerateInputs();
      const previousActiveBranch = originalContext.activeBranch;

      const result = await (async function() {
        try {
          for (const input of pipelineInputs) {
            const oldContext = deepClone(originalContext);

            const result = await leafPipeline.processLeaf(input, {
              oldContext,
              inputText
            });

            if (!!result) return result;
          }

          throw new Error(
            'No leaf found for ' +
              `input ${inputText} and ` +
              `context ${JSON.stringify(originalContext)}`
          );
        } catch ({ message: text }) {
          return {
            newContext: {
              ...deepClone(originalContext),
              activeBranch: ERROR_LEAF_ID
            },
            visualContents: [{ response: { text } }]
          } as LeafSelector.Result<C>;
        }
      })();

      const newContext = await selector.clearPreviouslyActiveBranch(
        pipelineInputs,
        result.newContext,
        previousActiveBranch
      );

      return { ...result, newContext };
    }
  };

  return selector;
}
