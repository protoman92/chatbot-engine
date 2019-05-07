import { INVALID_NEXT_RESULT } from '..';
import { compose, requireKeys } from '../common/utils';
import { DefaultContext } from '../type/common';
import { Leaf } from '../type/leaf';

/**
 * Map one context type to another.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf compose function.
 */
export function mapLeafContext<C1, C2 extends C1>(
  fn: (context: C2 & DefaultContext) => Promise<C1 & DefaultContext>
): Leaf.ComposeFunc<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async context => leaf.next(await fn(context))
  });
}

/**
 * Map one context type to another, but returns invalid if the resulting context
 * object is null or undefined.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf compose function.
 */
export function compactMapLeafContext<C1, C2 extends C1>(
  fn: (
    context: C2 & DefaultContext
  ) => Promise<C1 & DefaultContext | undefined | null>
): Leaf.ComposeFunc<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async context => {
      const newContext = await fn(context);

      if (newContext === undefined || newContext === null) {
        return INVALID_NEXT_RESULT;
      }

      return leaf.next(newContext);
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
  ...keys: readonly K[]
): Leaf.ComposeFunc<C, C & Required<{ [K1 in K]: NonNullable<C[K1]> }>> {
  return mapLeafContext(async context => requireKeys(context, ...keys));
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
    ...composeFuncs: readonly Leaf.ComposeFunc<any, any>[]
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
