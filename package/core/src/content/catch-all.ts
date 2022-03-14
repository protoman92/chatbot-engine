import { AmbiguousGenericRequest, LeafTransformer } from "../type";
import { NextResult } from "./leaf";

export function catchAll(
  onCatchAll: (request: AmbiguousGenericRequest) => void
): LeafTransformer {
  return (leaf) => ({
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
