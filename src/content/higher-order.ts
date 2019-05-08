import { INVALID_NEXT_RESULT } from '..';
import { compose, requireKeys } from '../common/utils';
import { DefaultContext } from '../type/common';
import { Leaf } from '../type/leaf';

/**
 * Map one context type to another.
 * @template C1 The original context type.
 * @template C2 The target context type.
 * @param fn The context mapper function.
 * @return A leaf transformer.
 */
export function mapLeafContext<C1, C2 extends C1>(
  fn: (context: C2 & DefaultContext) => Promise<C1 & DefaultContext>
): Leaf.Transformer<C1, C2> {
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
 * @return A leaf transformer.
 */
export function compactMapLeafContext<C1, C2 extends C1>(
  fn: (
    context: C2 & DefaultContext
  ) => Promise<C1 & DefaultContext | undefined | null>
): Leaf.Transformer<C1, C2> {
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
 * @return A leaf transformer.
 */
export function requireContextKeys<C, K extends keyof C>(
  ...keys: readonly K[]
): Leaf.Transformer<C, C & Required<{ [K1 in K]: NonNullable<C[K1]> }>> {
  return mapLeafContext(async context => requireKeys(context, ...keys));
}

/**
 * Create a leaf transform chain to enhance a leaf declaratively.
 * @template I The input context type.
 * @template O The output context type.
 * @return A leaf transform chain.
 */
export function createLeafTransformChain<I, O>(): Leaf.TransformChain<I, O> {
  function composeLeaf(
    originalLeaf: Leaf<any>,
    ...transformers: readonly Leaf.Transformer<any, any>[]
  ): Leaf<any> {
    return compose(
      originalLeaf,
      ...transformers
    );
  }

  const transformers: Leaf.Transformer<any, any>[] = [];

  const transformChain: Leaf.TransformChain<I, O> = {
    compose: <CI1>(fn: Leaf.Transformer<CI1, I>) => {
      transformers.push(fn);
      return transformChain as any;
    },
    enhance: leaf => composeLeaf(leaf, ...transformers),
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain
  };

  return transformChain;
}
