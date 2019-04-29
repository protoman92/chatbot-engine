import { deepClone, joinPaths } from '../common/utils';
import { Context } from '../type/common';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';
import { NextResult } from '../type/stream';

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
     * @param param0 The enumerated leaf instance.
     * @param originalContext The old context.
     * @return An updated context object.
     */
    prepareIncomingContext: async (
      {
        currentLeaf,
        currentLeafID,
        parentBranch,
        prefixLeafPaths
      }: LeafSelector.EnumeratedLeaf<C>,
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
      enumeratedLeaf: input,
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
