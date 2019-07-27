import { GenericResponse } from "../../type/response";
import { Leaf } from "../../type/leaf";
import { createLeafWithObserver } from "../leaf";

/**
 * Map output of a leaf to another output.
 * @param CI The original input type.
 * @param CO The target input type.
 */
export function higherOrderMapOutput<CI, CO extends CI>(
  fn: (response: GenericResponse<CI>) => Promise<GenericResponse<CO>>
): Leaf.Transformer<CI, CO> {
  return async leaf => {
    return createLeafWithObserver(async observer => {
      await leaf.subscribe({
        next: async input => {
          const newInput = await fn(input);
          return observer.next(newInput);
        }
      });

      return {
        next: async input => leaf.next(input),
        complete: async () => !!leaf.complete && leaf.complete()
      };
    });
  };
}
