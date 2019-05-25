import { compose } from '../../common/utils';
import { Leaf } from '../../type/leaf';

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
    compose: <CI1>(fn: Leaf.Transformer<CI1, CI>) => {
      composeTransformers.unshift(fn);
      return transformChain as any;
    },
    transform: leaf => {
      const outputLeaf = cl(leaf, ...composeTransformers) as Leaf<CO>;
      return { ...outputLeaf, toPipe: () => createPipeChain(outputLeaf) };
    },
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain
  };

  return transformChain;
}

/**
 * Create a pipe chain from an original leaf.
 * @param C The context used by the current chatbot.
 */
export function createPipeChain<C>(leaf: Leaf<C>): Leaf.PipeChain<C, C> {
  const pipeTransformers: Leaf.Transformer<any, any>[] = [];

  const pipeChain: Leaf.PipeChain<C, C> = {
    pipe: <CO1>(fn: Leaf.Transformer<C, CO1>): Leaf.PipeChain<C, CO1> => {
      pipeTransformers.push(fn);
      return pipeChain as any;
    },
    transform: () => pipeTransformers.reduce((acc, item) => item(acc), leaf)
  };

  return pipeChain;
}
