import { compose } from '../../common/utils';
import { Leaf, LeafWithPipe } from '../../type/leaf';

/**
 * Create a pipeable leaf from an original leaf.
 * @template C The original context type.
 */
export function createLeafWithPipe<C>(leaf: Leaf<C>): LeafWithPipe<C> {
  return {
    ...leaf,
    pipe: async fn => {
      const newLeaf = await fn(leaf);
      return createLeafWithPipe(newLeaf);
    }
  };
}

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
    transform: async leaf => {
      const outputLeaf = (await compose(
        leaf,
        ...composeTransformers
      )) as Leaf<CO>;

      return createLeafWithPipe(outputLeaf);
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
export function createPipeChain<C>(): Leaf.PipeChain<C, C> {
  const pipeTransformers: Leaf.Transformer<any, any>[] = [];

  const pipeChain: Leaf.PipeChain<C, C> = {
    pipe: <CO1>(fn: Leaf.Transformer<C, CO1>): Leaf.PipeChain<C, CO1> => {
      pipeTransformers.push(fn);
      return pipeChain as any;
    },
    transform: async leaf => {
      const outputLeaf = await compose(
        leaf,
        ...pipeTransformers
      );

      return createLeafWithPipe(outputLeaf);
    },
    forContextOfType: () => pipeChain as any,
    checkThis: () => pipeChain
  };

  return pipeChain;
}
