import { compose } from '../../common/utils';
import { Leaf } from '../../type/leaf';

/**
 * Create a leaf compose chain to transform a leaf declaratively.
 * @template CI The original context type.
 * @template CO The target context type.
 * @return A leaf compose chain.
 */
export function createComposeChain<CI, CO>(): Leaf.ComposeChain<CI, CO> {
  const composeTransformers: Leaf.Transformer<any, any>[] = [];

  const composeChain: Leaf.ComposeChain<CI, CO> = {
    compose: <CI1>(fn: Leaf.Transformer<CI1, CI>) => {
      composeTransformers.unshift(fn);
      return composeChain as any;
    },
    transform: leaf => {
      const outputLeaf = compose(
        leaf,
        ...composeTransformers
      ) as Leaf<CO>;

      return { ...outputLeaf, toPipe: () => createPipeChain(outputLeaf) };
    },
    forContextOfType: () => composeChain as any,
    checkThis: () => composeChain
  };

  return composeChain;
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
