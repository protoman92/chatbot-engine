import { deepClone, toArray } from '../common/utils';
import { Branch } from '../type/branch';
import { Context, KV } from '../type/common';
import { Leaf, LeafContentInput } from '../type/leaf';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';

/**
 * Join the path components of a branch to produce the full path.
 * @param pathComponents An Array of path components.
 * @return The full path.
 */
export function joinPaths(...pathComponents: string[]) {
  return pathComponents.join('.');
}

/**
 * Enumerate a key-value branch object to produce the entire list of pipeline
 * inputs.  Each pipeline input will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 * @template C The shape of the context used by the current chatbot.
 * @param branches A key-value object of branches.
 * @return An Array of pipeline inputs.
 */
export function enumerateLeafPipelineInputs<C extends Context>(
  branches: KV<Branch<C>>
): LeafPipeline.Input<C>[] {
  function enumerate(
    allBranches: KV<Branch<C>>,
    prefixPaths?: string[]
  ): LeafPipeline.Input<C>[] {
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
 * @template C The shape of the context used by the current chatbot.
 * @return A leaf pipeline instance.
 */
export function createLeafPipeline<C extends Context>() {
  const pipeline = {
    /**
     * When we start a new pipeline, we may want to modify the old context, e.g.
     * clear out the relevant keys if the current leaf marks the start of a
     * branch, so that we do not have conflicting state as we progress through
     * the branch.
     * @param arg0 The pipeline input.
     * @param oldContext The old context.
     */
    prepareIncomingContext: async (
      { parentBranch, prefixLeafPaths, currentLeaf }: LeafPipeline.Input<C>,
      oldContext: C
    ) => {
      if (
        !!currentLeaf.isStartOfBranch &&
        (await currentLeaf.isStartOfBranch()) &&
        !!parentBranch.contextKeys
      ) {
        parentBranch.contextKeys.forEach(key => delete oldContext[key]);
      }

      return oldContext;
    },

    /**
     * When we end a pipeline, we may want to modify the outgoing context, e.g.
     * if the current leaf marks the end of a branch, we need to clear out the
     * activeBranch key.
     */
    prepareOutgoingContext: async (
      { parentBranch: { contextKeys }, currentLeaf }: LeafPipeline.Input<C>,
      newContext: C
    ) => {
      if (
        !!currentLeaf.isEndOfBranch &&
        (await currentLeaf.isEndOfBranch(newContext))
      ) {
        const activeBranchKey: Context['activeBranch'] = 'activeBranch';
        const clearableKeys = [activeBranchKey, ...(contextKeys || [])];
        clearableKeys.forEach(key => delete newContext[key]);
      }

      return newContext;
    },

    /**
     * Extract text matches from an input text.
     * @param currentLeaf The leaf whose text conditions will be used to match.
     * @param inputText The input text.
     * @return The relevant text matches.
     */
    extractTextMatches: async (currentLeaf: Leaf<C>, inputText?: string) => {
      const textMatches = !!inputText
        ? await currentLeaf.checkTextConditions(inputText)
        : ['This should be ignored'];

      if (typeof textMatches === 'boolean') {
        return { allTextMatches: [] };
      }

      const allTextMatches = toArray(textMatches);
      const lastTextMatch = allTextMatches[allTextMatches.length - 1];
      return { allTextMatches, lastTextMatch };
    },

    processLeaf: async (
      input: LeafPipeline.Input<C>,
      {
        oldContext: originalContext,
        inputText
      }: LeafPipeline.AdditionalParams<C>
    ): Promise<LeafSelector.Result<C> | null> => {
      const { currentLeaf, currentLeafID } = input;
      let oldContext = deepClone(originalContext);
      oldContext = await pipeline.prepareIncomingContext(input, oldContext);
      if (!(await currentLeaf.checkContextConditions(oldContext))) return null;

      const {
        allTextMatches,
        lastTextMatch
      } = await pipeline.extractTextMatches(currentLeaf, inputText);

      if (!lastTextMatch) return null;
      let newContext = deepClone(oldContext);

      const leafInput: LeafContentInput<C> = {
        oldContext,
        newContext,
        inputText,
        allTextMatches,
        lastTextMatch
      };

      const leafContent = await currentLeaf.produceOutgoingContent(leafInput);
      newContext = leafContent.newContext;
      const { outgoingContents } = leafContent;
      if (!outgoingContents.length) return null;
      newContext = await pipeline.prepareOutgoingContext(input, newContext);
      return { currentLeafID, outgoingContents, newContext };
    }
  };

  return pipeline;
}
