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
    next: async (request) => {
      if (request.type === "context_trigger") return NextResult.FALLTHROUGH;
      if (request.input.type !== "text") return NextResult.FALLTHROUGH;
      const { currentContext } = request;

      const result = await leaf.next({
        ...request,
        currentContext: { ...currentContext, witEntities: {} },
      });

      if (isNullOrUndefined(result)) {
        const { entities: witEntities } = await comm.validate(
          request.input.inputText
        );

        return leaf.next({
          ...request,
          currentContext: { ...currentContext, witEntities },
        });
      }

      return result;
    },
  });
}
