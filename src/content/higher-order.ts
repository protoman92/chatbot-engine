import { INVALID_NEXT_RESULT } from '..';
import { compose, requireKeys } from '../common/utils';
import { Leaf } from '../type/leaf';

/**
 * Map input type to another.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The input mapper function.
 * @return A leaf compose function.
 */
export function mapLeafInput<C1, C2 extends C1>(
  fn: (input: Leaf.Input<C2>) => Promise<Leaf.Input<C1>>
): Leaf.ComposeFunc<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async input => leaf.next(await fn(input))
  });
}

/**
 * Map one context type to another.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf compose function.
 */
export function mapLeafContext<C1, C2 extends C1>(fn: (context: C2) => C1) {
  return mapLeafInput<C1, C2>(async ({ oldContext, ...restInput }) => ({
    ...restInput,
    oldContext: fn(oldContext)
  }));
}

/**
 * Map one input type to another, but returns invalid if the resulting input
 * object is null or undefined.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The input mapper function.
 * @return A leaf compose function.
 */
export function compactMapLeafInput<C1, C2 extends C1>(
  fn: (input: Leaf.Input<C2>) => Promise<Leaf.Input<C1> | undefined | null>
): Leaf.ComposeFunc<C1, C2> {
  return leaf => ({
    ...leaf,
    next: async input => {
      const newInput = await fn(input);

      if (newInput === undefined || newInput === null) {
        return INVALID_NEXT_RESULT;
      }

      return leaf.next(newInput);
    }
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
  fn: (context: C2) => Promise<C1 | undefined | null>
) {
  return compactMapLeafInput<C1, C2>(
    async ({ oldContext: originalContext, ...restInput }) => {
      const oldContext = await fn(originalContext);

      return oldContext !== undefined && oldContext !== null
        ? { ...restInput, oldContext }
        : null;
    }
  );
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
  return mapLeafInput(async ({ oldContext, ...restInput }) => ({
    ...restInput,
    oldContext: requireKeys(oldContext, ...keys)
  }));
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
