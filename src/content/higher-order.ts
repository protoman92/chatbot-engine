import { compose, requireKeys } from '../common/utils';
import { Leaf } from '../type/leaf';

/**
 * Map one context type to another.
 * @param C1 The original context type.
 * @param C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf compose function.
 */
export function mapContext<C1, C2 extends C1>(
  fn: (oldContext: C2) => C1
): Leaf.ComposeFunc<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async ({ oldContext, ...restInput }) => {
      return leaf.next({ ...restInput, oldContext: fn(oldContext) });
    }
  });
}

/**
 * Require keys in old context.
 * @param C The original context type.
 * @param keys The keys to be required.
 * @return A leaf compose function.
 */
export function requireContextKeys<C, K extends keyof C>(
  ...keys: K[]
): Leaf.ComposeFunc<C, C & Required<{ [K1 in K]: NonNullable<C[K1]> }>> {
  return mapContext(oldContext => requireKeys(oldContext, ...keys));
}

/**
 * Create a leaf compose chain to enhance a leaf declaratively.
 * @template CI The input context type.
 * @template CO The output context type.
 * @return A leaf compose chain.
 */
export function createLeafComposeChain<CI, CO>(): Leaf.ComposeChain<CI, CO> {
  function composeLeaf(
    originalLeaf: Leaf<any>,
    ...composeFuncs: Leaf.ComposeFunc<any, any>[]
  ): Leaf<any> {
    return compose(
      originalLeaf,
      ...composeFuncs
    );
  }

  const composeFuncs: Leaf.ComposeFunc<any, any>[] = [];

  const composeChain: Leaf.ComposeChain<CI, CO> = {
    compose: <CI1>(fn: Leaf.ComposeFunc<CI1, CI>) => {
      composeFuncs.push(fn);
      return composeChain as any;
    },
    enhance: leaf => composeLeaf(leaf, ...composeFuncs),
    forContextOfType: () => composeChain as any,
    checkThis: () => composeChain
  };

  return composeChain;
}
