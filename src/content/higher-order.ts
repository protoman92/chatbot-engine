import { Context } from '../type/common';
import { Leaf } from '../type/leaf';

/**
 * Map one context type to another.
 * @param C1 The original context type.
 * @param C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf compose function.
 */
export function mapContext<C1 extends Context, C2 extends C1>(
  fn: (oldContext: C1) => C2
): Leaf.ComposeFunc<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async ({ oldContext, ...restInput }) => {
      return leaf.next({ ...restInput, oldContext: fn(oldContext) });
    }
  });
}
