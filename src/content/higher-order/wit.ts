import { isNullOrUndefined } from "util";
import { LeafTransformer } from "../../type/leaf";
import { WitClient, WitContext } from "../../type/wit";

/**
 * Retry a failing message with wit, by running the input text through wit
 * engine and injecting entities into leaf input.
 * @template C The original input type.
 */
export function retryWithWit<C>(
  comm: WitClient
): LeafTransformer<C & WitContext, C> {
  return async (leaf) => ({
    ...leaf,
    next: async (input) => {
      const result = await leaf.next({ ...input, witEntities: {} });

      if (isNullOrUndefined(result)) {
        const { entities: witEntities } = await comm.validate(input.inputText);
        return leaf.next({ ...input, witEntities });
      }

      return result;
    },
  });
}
