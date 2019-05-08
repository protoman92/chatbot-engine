import { STREAM_INVALID_NEXT_RESULT } from '../../stream/stream';
import { DefaultContext } from '../../type/common';
import { Leaf } from '../../type/leaf';

/**
 * Map one context type to another, but returns invalid if the resulting context
 * object is null or undefined.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf transformer.
 */
export function compactMapContext<C1, C2 extends C1>(
  fn: (
    context: C2 & DefaultContext
  ) => Promise<C1 & DefaultContext | undefined | null>
): Leaf.Transformer<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async context => {
      const newContext = await fn(context);

      if (newContext === undefined || newContext === null) {
        return STREAM_INVALID_NEXT_RESULT;
      }

      return leaf.next(newContext);
    }
  });
}
