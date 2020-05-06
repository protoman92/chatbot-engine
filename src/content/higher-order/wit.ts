import { isNullOrUndefined } from "util";
import { NextResult } from "../../stream";
import { LeafTransformer } from "../../type/leaf";
import { WitClient, WitContext } from "../../type/wit";

/**
 * Retry a failing message with wit, by running the input text through wit
 * engine and injecting entities into leaf input.
 */
export function retryWithWit<Context>(
  comm: WitClient
): LeafTransformer<Context & WitContext, Context> {
  return async (leaf) => ({
    ...leaf,
    next: async (input) => {
      if (!("inputText" in input)) return NextResult.FAILURE;
      const result = await leaf.next({ ...input, witEntities: {} });

      if (isNullOrUndefined(result)) {
        const { entities: witEntities } = await comm.validate(input.inputText);
        return leaf.next({ ...input, witEntities });
      }

      return result;
    },
  });
}
