import { STREAM_INVALID_NEXT_RESULT } from '../../stream/stream';
import { DefaultContext } from '../../type/common';
import { Leaf } from '../../type/leaf';

/**
 * Map one input type to another.
 * @template CI The original context type.
 * @template CO The target context type.
 * @param fn The input mapper function.
 * @return A leaf transformer.
 */
export function mapInput<CI, CO extends CI>(
  fn: (context: CO & DefaultContext) => Promise<CI & DefaultContext>
): Leaf.Transformer<CI, CO> {
  return leaf => ({
    ...leaf,
    next: async context => leaf.next(await fn(context))
  });
}

/**
 * Map one input type to another, but returns invalid if the resulting input
 * object is null or undefined.
 * @template CI The original context type.
 * @template CO The target context type.
 * @param fn The input mapper function.
 * @return A leaf transformer.
 */
export function compactMapInput<CI, CO extends CI>(
  fn: (
    context: CO & DefaultContext
  ) => Promise<CI & DefaultContext | undefined | null>
): Leaf.Transformer<CI, CO> {
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
