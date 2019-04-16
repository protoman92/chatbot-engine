import { deepClone, toArray } from '../common/utils';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { Leaf, LeafInput } from '../type/leaf';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';

/**
 * Enumerate a key-value branch object to produce the entire list of pipeline
 * inputs.  Each pipeline input will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 * @param branches A key-value object of branches.
 * @return An Array of pipeline inputs.
 */
export function enumerateLeafPipelineInputs<Ctx extends Context>(
  branches: KV<Branch<Ctx>>
): LeafPipeline.Input<Ctx>[] {
  function enumerate(
    allBranches: KV<Branch<Ctx>>,
    prefixPaths?: string[]
  ): LeafPipeline.Input<Ctx>[] {
    let inputs: LeafPipeline.Input<Ctx>[] = [];
    const branchEntries = Object.entries(allBranches);

    for (const [branchID, parentBranch] of branchEntries) {
      if (!parentBranch) continue;
      const prefixLeafPaths = [...(prefixPaths || []), branchID];
      const { subBranches, leaves } = parentBranch;

      if (leaves !== undefined && leaves !== null) {
        const leafEntries = Object.entries(leaves);

        for (const [leafID, leaf] of leafEntries) {
          if (!leaf) continue;
          inputs.push({ parentBranch, leaf, leafID, prefixLeafPaths });
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
 * Create a leaf pipeline.
 * @return A leaf pipeline instance.
 */
export async function createLeafPipeline<Ctx extends Context>() {
  const pipeline = {
    extractTextMatches: async (leaf: Leaf<Ctx>, inputText?: string) => {
      const textMatches = !!inputText
        ? await leaf.checkTextConditions(inputText)
        : ['This should be ignored'];

      if (typeof textMatches === 'boolean') {
        return { allTextMatches: [] };
      }

      const allTextMatches = toArray(textMatches);
      const lastTextMatch = allTextMatches[allTextMatches.length - 1];
      return { allTextMatches, lastTextMatch };
    },

    processLeaf: async (
      { prefixLeafPaths, leaf, leafID }: LeafPipeline.Input<Ctx>,
      { oldContext: originalCtx, inputText }: LeafPipeline.AdditionalParams<Ctx>
    ): Promise<LeafSelector.Result<Ctx> | null> => {
      const oldContext = deepClone(originalCtx);
      if (!(await leaf.checkContextConditions(oldContext))) return null;

      const {
        allTextMatches,
        lastTextMatch
      } = await pipeline.extractTextMatches(leaf, inputText);

      if (!lastTextMatch) return null;
      const placeboNewContext = deepClone(oldContext);

      const leafInput: LeafInput<Ctx> = {
        oldContext,
        inputText,
        allTextMatches,
        lastTextMatch,
        newContext: placeboNewContext
      };

      const {
        newContext,
        outgoingContents
      } = await leaf.produceOutgoingContent(leafInput);

      if (!outgoingContents.length) return null;
      return { leafID, outgoingContents, newContext };
    }
  };

  return pipeline;
}
