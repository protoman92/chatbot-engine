import { NextResult } from "../stream";
import { AmbiguousRequest } from "../type";
import { LeafTransformer } from "../type/leaf";

export function catchAll<Context>(
  onCatchAll: (request: AmbiguousRequest<Context>) => void
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    ...leaf,
    next: async (request) => {
      const result = await leaf.next(request);

      if (request.type === "context_trigger" || result === NextResult.BREAK) {
        return result;
      }

      onCatchAll(request);
      return NextResult.BREAK;
    },
  });
}
