import { deepClone, formatSpecialKey, joinPaths } from '../common/utils';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { LeafPipeline } from '../type/leaf-pipeline';
import { NextResult } from '../type/stream';

/** Represents an ignored text match. */
export const IGNORED_TEXT_MATCH = formatSpecialKey('ignored-text-match');

/**
 * Enumerate a key-value branch object to produce the entire list of pipeline
 * inputs.  Each pipeline input will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 * @template C The context used by the current chatbot.
 * @param branches A key-value object of branches.
 * @return An Array of pipeline inputs.
 */
export function enumerateLeafPipelineInputs<C extends Context>(
  branches: KV<Branch<C>>
): readonly LeafPipeline.Input<C>[] {
  function enumerate(
    allBranches: KV<Branch<C>>,
    prefixPaths?: readonly string[]
  ): readonly LeafPipeline.Input<C>[] {
    let inputs: LeafPipeline.Input<C>[] = [];
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
 * Create a leaf pipeline.
 * @template C The context used by the current chatbot.
 * @return A leaf pipeline instance.
 */
export function createLeafPipeline<C extends Context>() {
  const pipeline = {
    /**
     * When we start a new pipeline, we may want to modify the old context, e.g.
     * clear out the relevant keys if the current leaf marks the start of a
     * branch, so that we do not have conflicting state as we progress through
     * the branch.
     * @param param0 The pipeline input.
     * @param originalContext The old context.
     * @return An updated context object.
     */
    prepareIncomingContext: async (
      {
        currentLeaf,
        currentLeafID,
        parentBranch,
        prefixLeafPaths
      }: LeafPipeline.Input<C>,
      originalContext: C
    ) => {
      let oldContext = originalContext;

      if (
        !!currentLeaf.isStartOfBranch &&
        (await currentLeaf.isStartOfBranch()) &&
        !!parentBranch.contextKeys
      ) {
        parentBranch.contextKeys.forEach(key => delete oldContext[key]);
        const activeBranch = joinPaths(...prefixLeafPaths, currentLeafID);
        oldContext = { ...oldContext, activeBranch };
      }

      return oldContext;
    },

    next: async ({
      senderID,
      pipelineInput: input,
      additionalParams: { oldContext: originalContext, inputText }
    }: LeafPipeline.ObserverInput<C>): Promise<NextResult> => {
      const { currentLeaf } = input;
      let oldContext = deepClone(originalContext);
      oldContext = await pipeline.prepareIncomingContext(input, oldContext);
      return currentLeaf.next({ senderID, oldContext, inputText });
    }
  };

  return pipeline;
}
