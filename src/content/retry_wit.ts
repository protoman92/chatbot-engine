import { NextResult } from "../stream";
import { LeafTransformer } from "../type/leaf";
import { WitClient } from "../type/wit";

/**
 * Retry a failing message with wit, by running the input text through wit
 * engine and injecting entities into leaf input.
 */
export function retryWithWit<Context>(
  comm: WitClient
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    ...leaf,
    next: async (request) => {
      if (request.input.type !== "text") return NextResult.FALLTHROUGH;
      let result = await leaf.next(request);

      if (result !== NextResult.BREAK) {
        const { entities } = await comm.validate(request.input.inputText);

        result = await leaf.next({
          ...(request as Omit<typeof request, "input" | "type">),
          input: { entities, type: "wit" },
          targetPlatform: request.targetPlatform as any,
          type: "manual_trigger",
        });
      }

      return result;
    },
  });
}
