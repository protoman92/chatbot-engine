import { deepClone, formatSpecialKey, toArray } from '../common/utils';
import { Branch } from '../type/branch';
import { Context, DefaultContext, KV } from '../type/common';
import { Leaf, LeafContentInput } from '../type/leaf';
import { LeafPipeline } from '../type/leaf-pipeline';
import { LeafSelector } from '../type/leaf-selector';

/** Represents an ignored text match. */
export const IGNORED_TEXT_MATCH = formatSpecialKey('ignored-text-match');

/**
 * Join the path components of a branch to produce the full path.
 * @param pathComponents An Array of path components.
 * @return The full path.
 */
export function joinPaths(...pathComponents: readonly string[]) {
  return pathComponents.join('.');
}

/**
 * Extract the current leaf ID from active branch.
 * @param activeBranch The current active branch.
 * @return The current leaf ID.
 */
export function getCurrentLeafID(activeBranch?: string): string | null {
  if (!activeBranch) return null;
  const branchPaths = activeBranch.split('.');
  return branchPaths.length > 0 ? branchPaths[branchPaths.length - 1] : null;
}

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

    /**
     * When we end a pipeline, we may want to modify the outgoing context, e.g.
     * if the current leaf marks the end of a branch, we need to clear out the
     * activeBranch key.
     * @param param0 The pipeline input.
     * @param newContext The new context.
     * @return An updated context object.
     */
    prepareOutgoingContext: async (
      {
        parentBranch: { contextKeys },
        currentLeaf
      }: Pick<LeafPipeline.Input<C>, 'parentBranch' | 'currentLeaf'>,
      newContext: C
    ) => {
      if (
        !!currentLeaf.isEndOfBranch &&
        (await currentLeaf.isEndOfBranch(newContext))
      ) {
        const activeBranchKey: keyof DefaultContext = 'activeBranch';
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
    extractTextMatches: async (
      currentLeaf: Pick<Leaf<C>, 'checkTextConditions'>,
      inputText?: string
    ) => {
      const textMatches = !!inputText
        ? await currentLeaf.checkTextConditions(inputText)
        : [IGNORED_TEXT_MATCH];

      let allTextMatches: readonly string[] = [];
      if (typeof textMatches === 'boolean') return { allTextMatches };
      allTextMatches = toArray(textMatches);
      const lastTextMatch = allTextMatches[allTextMatches.length - 1];
      return { allTextMatches, lastTextMatch };
    },

    processLeaf: async (
      input: LeafPipeline.Input<C>,
      {
        oldContext: originalContext,
        inputText
      }: Pick<LeafPipeline.AdditionalParams<C>, 'oldContext' | 'inputText'>
    ): Promise<LeafSelector.Result<C> | null> => {
      const { currentLeaf } = input;
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

      const leafContent = await currentLeaf.produceVisualContent(leafInput);
      newContext = leafContent.newContext;
      const { visualContents } = leafContent;
      if (!visualContents.length) return null;
      newContext = await pipeline.prepareOutgoingContext(input, newContext);
      return { newContext, visualContents };
    }
  };

  return pipeline;
}
