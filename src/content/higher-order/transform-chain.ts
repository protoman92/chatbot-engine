import { compose } from '../../common/utils';
import { Leaf } from '../../type/leaf';

/**
 * Create a leaf transform chain to enhance a leaf declaratively.
 * @template I The input context type.
 * @template O The output context type.
 * @return A leaf transform chain.
 */
export function createTransformChain<I, O>(): Leaf.TransformChain<I, O> {
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
