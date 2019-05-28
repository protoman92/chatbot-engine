import { STREAM_INVALID_NEXT_RESULT } from '../../stream/stream';
import { DefaultContext } from '../../type/common';
import { Leaf } from '../../type/leaf';

/**
 * Map one input type to another.
 * @template CI The original input type.
 * @template CO The target input type.
 */
export function mapInput<CI, CO extends CI>(
  fn: (input: CO & DefaultContext) => Promise<CI & DefaultContext>
): Leaf.Transformer<CI, CO> {
  return async leaf => ({
    ...leaf,
    next: async input => leaf.next(await fn(input))
  });
}

/**
 * Map one input type to another, but returns invalid if the resulting input
 * object is null or undefined.
 * @template CI The original input type.
 * @template CO The target input type.
 */
export function compactMapInput<CI, CO extends CI>(
  fn: (
    input: CO & DefaultContext
  ) => Promise<CI & DefaultContext | undefined | null>
): Leaf.Transformer<CI, CO> {
  return async leaf => ({
    ...leaf,
    next: async input => {
      const newInput = await fn(input);

      if (newInput === undefined || newInput === null) {
        return STREAM_INVALID_NEXT_RESULT;
      }

      return leaf.next(newInput);
    }
  });
}
