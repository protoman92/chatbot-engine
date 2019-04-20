import { deepClone, formatSpecialKey } from '../common/utils';
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
    selectLeaf: async (originalContext: C, inputText: string) => {
      const pipelineInputs = await selector.enumerateInputs();

      const result = (async function() {
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

      return result;
    }
  };

  return selector;
}
