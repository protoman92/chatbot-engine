import { compose } from "../../common/utils";
import { Leaf } from "../../type/leaf";

/**
 * Create a leaf transform chain to transform a leaf declaratively.
 * @template CI The original context type.
 * @template CO The target context type.
 */
export function createTransformChain<CI, CO>(): Leaf.TransformChain<CI, CO> {
  const pipeTransformers: Leaf.Transformer<any, any>[] = [];

  const transformChain: Leaf.TransformChain<CI, CO> = {
    pipe: <CO1>(fn: Leaf.Transformer<CO, CO1>) => {
      pipeTransformers.push(fn);
      return transformChain as any;
    },
    transform: async leaf => {
      return compose(
        leaf,
        ...pipeTransformers
      );
    },
    forContextOfType: () => transformChain as any,
    checkThis: () => transformChain
  };

  return transformChain;
}
