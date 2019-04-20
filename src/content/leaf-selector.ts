import { deepClone } from '../common/utils';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';
import { enumerateLeafPipelineInputs } from './leaf-pipeline';

/**
 * Create a leaf selector.
 * @template C The shape of the context used by the current chatbot.
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

      try {
        for (const input of pipelineInputs) {
          const oldContext = deepClone(originalContext);

          const result = await leafPipeline.processLeaf(input, {
            oldContext,
            inputText
          });

          if (!!result) return result;
        }

        const jsonContext = JSON.stringify(originalContext);

        throw new Error(
          `No leaf found for input ${inputText} and context ${jsonContext}`
        );
      } catch ({ message: text }) {
        return {
          currentLeafID: 'error',
          newContext: deepClone(originalContext),
          visualContents: [{ response: { text } }]
        } as LeafSelector.Result<C>;
      }
    }
  };

  return selector;
}
