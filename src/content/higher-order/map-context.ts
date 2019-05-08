import { DefaultContext } from '../../type/common';
import { Leaf } from '../../type/leaf';

/**
 * Map one context type to another.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf transformer.
 */
export function mapContext<C1, C2 extends C1>(
  fn: (context: C2 & DefaultContext) => Promise<C1 & DefaultContext>
): Leaf.Transformer<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async context => leaf.next(await fn(context))
  });
}
