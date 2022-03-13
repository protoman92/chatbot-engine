import { transform } from "../common/utils";
import { LeafTransformChain, LeafTransformer } from "../type";

/** Create a leaf transform chain to transform a leaf declaratively */
export function createTransformChain(): LeafTransformChain {
  const pipeTransformers: LeafTransformer[] = [];

  const transformChain: LeafTransformChain = {
    pipe: (fn: LeafTransformer) => {
      pipeTransformers.push(fn);
      return transformChain;
    },
    transform: (leaf) => {
      return transform(leaf, ...pipeTransformers);
    },
  };

  return transformChain;
}
