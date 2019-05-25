import { compose } from '../../common/utils';
import { Leaf, LeafWithPipe } from '../../type/leaf';

/**
 * Create a new leaf with pipe functionality from an original leaf.
 * @template C The context used by the current chatbot.
 */
export function createLeafWithPipe<C>(leaf: Leaf<C>): LeafWithPipe<C> {
  const leafWithPipe = {
    ...leaf,
    pipe: <C1>(transformer: Leaf.Transformer<C, C1>) => {
      const newLeaf = transformer(leafWithPipe);
      return createLeafWithPipe(newLeaf);
    }
  };

  return leafWithPipe;
}

/**
 * Create a leaf transform chain to transform a leaf declaratively.
 * @template CI The original context type.
 * @template CO The target context type.
 * @return A leaf transform chain.
 */
export function createTransformChain<CI, CO>(): Leaf.TransformChain<CI, CO> {
  function cl(
    originalLeaf: Leaf<any>,
    ...transformers: readonly Leaf.Transformer<any, any>[]
  ): Leaf<any> {
    return compose(
      originalLeaf,
      ...transformers
    );
  }

  const composeTransformers: Leaf.Transformer<any, any>[] = [];

  const transformChain: Leaf.TransformChain<CI, CO> = {
    compose: <I1>(fn: Leaf.Transformer<I1, CI>) => {
      composeTransformers.unshift(fn);
      return transformChain as any;
    },
    transform: leaf => {
      const outputLeaf = cl(leaf, ...composeTransformers) as Leaf<CO>;
      return createLeafWithPipe(outputLeaf);
    },
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain
  };

  return transformChain;
}
