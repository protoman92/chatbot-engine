import { compose } from "../../common/utils";
import { LeafTransformChain, LeafTransformer } from "../../type/leaf";

/** Create a leaf transform chain to transform a leaf declaratively */
export function createTransformChain<
  InContext,
  OutContext
>(): LeafTransformChain<InContext, OutContext> {
  const pipeTransformers: LeafTransformer<any, any>[] = [];

  const transformChain: LeafTransformChain<InContext, OutContext> = {
    pipe: <CO1>(fn: LeafTransformer<OutContext, CO1>) => {
      pipeTransformers.push(fn);
      return transformChain as any;
    },
    transform: async (leaf) => {
      return compose(leaf, ...pipeTransformers);
    },
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain,
  };

  return transformChain;
}
