import { Context, KV } from '../type/common';
import { Branch } from '../type/branch';
import { LeafPipelineInput } from '../type/leaf-pipeline';

/**
 * Enumerate a key-value branch object to produce the entire list of pipeline
 * inputs.  Each pipeline input will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 * @param branches A key-value object of branches.
 * @return An Array of pipeline inputs.
 */
export function enumerateLeafPipelineInputs<Ctx extends Context>(
  branches: KV<Branch<Ctx>>
): LeafPipelineInput<Ctx>[] {
  function enumerate(
    allBranches: KV<Branch<Ctx>>,
    prefixPaths?: string[]
  ): LeafPipelineInput<Ctx>[] {
    let inputs: LeafPipelineInput<Ctx>[] = [];
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
