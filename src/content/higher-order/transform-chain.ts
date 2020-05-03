import { compose } from "../../common/utils";
import { LeafTransformChain, LeafTransformer } from "../../type/leaf";

/**
 * Create a leaf transform chain to transform a leaf declaratively.
 * @template CI The original context type.
 * @template CO The target context type.
 */
export function createTransformChain<CI, CO>(): LeafTransformChain<CI, CO> {
  const pipeTransformers: LeafTransformer<any, any>[] = [];

  const transformChain: LeafTransformChain<CI, CO> = {
    pipe: <CO1>(fn: LeafTransformer<CO, CO1>) => {
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
