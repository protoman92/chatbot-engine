import { NextResult } from "../stream";
import { AmbiguousRequestPerInput } from "../type";
import { LeafTransformer } from "../type/leaf";

export function catchAll<Context>(
  onCatchAll: (request: AmbiguousRequestPerInput<Context>) => void
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    ...leaf,
    next: async (request) => {
      const result = await leaf.next(request);
      if (result === NextResult.BREAK) return result;
      onCatchAll(request);
      return NextResult.BREAK;
    },
  });
}
