import { compose } from '../../common/utils';
import { Leaf } from '../../type/leaf';

/**
 * Create a leaf transform chain to enhance a leaf declaratively.
 * @template I The input context type.
 * @template O The output context type.
 * @return A leaf transform chain.
 */
export function createTransformChain<I, O>(): Leaf.TransformChain<I, O> {
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
  const pipeTransformers: Leaf.Transformer<any, any>[] = [];

  const transformChain: Leaf.TransformChain<I, O> = {
    compose: <I1>(fn: Leaf.Transformer<I1, I>) => {
      composeTransformers.unshift(fn);
      return transformChain as any;
    },
    pipe: <O1>(fn: Leaf.Transformer<O, O1>): Leaf.TransformChain<I, O1> => {
      pipeTransformers.push(fn);
      return transformChain as any;
    },
    enhance: leaf => cl(cl(leaf, ...composeTransformers), ...pipeTransformers),
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain
  };

  return transformChain;
}
