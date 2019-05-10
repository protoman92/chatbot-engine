import { compose } from '../../common/utils';
import { Leaf } from '../../type/leaf';

/**
 * Create a leaf transform chain to enhance a leaf declaratively.
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
  const pipeTransformers: Leaf.Transformer<any, any>[] = [];

  const transformChain: Leaf.TransformChain<CI, CO> = {
    compose: <I1>(fn: Leaf.Transformer<I1, CI>) => {
      composeTransformers.unshift(fn);
      return transformChain as any;
    },
    pipe: <O1>(fn: Leaf.Transformer<CO, O1>): Leaf.TransformChain<CI, O1> => {
      pipeTransformers.push(fn);
      return transformChain as any;
    },
    enhance: leaf => cl(cl(leaf, ...composeTransformers), ...pipeTransformers),
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain
  };

  return transformChain;
}
