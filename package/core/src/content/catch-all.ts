import { NextResult } from "../stream";
import { AmbiguousGenericRequest, LeafTransformer } from "../type";

export function catchAll<Context>(
  onCatchAll: (request: AmbiguousGenericRequest<Context>) => void
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    ...leaf,
    next: async (request) => {
      const result = await leaf.next(request);

      if (
        request.input.type === "context_change" ||
        result === NextResult.BREAK
      ) {
        return result;
      }

      onCatchAll(request);
      return NextResult.BREAK;
    },
  });
}
