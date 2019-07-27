import { DefaultContext } from "../../type/common";
import { Leaf } from "../../type/leaf";

/**
 * Map one input type to another.
 * @template CI The original input type.
 * @template CO The target input type.
 */
export function higherOrderMapInput<CI, CO extends CI>(
  fn: (input: CO & DefaultContext) => Promise<CI & DefaultContext>
): Leaf.Transformer<CI, CO> {
  return async leaf => ({
    ...leaf,
    next: async input => leaf.next(await fn(input))
  });
}

/**
 * Map one input type to another, but returns invalid if the resulting input
 * object is null or undefined.
 * @template CI The original input type.
 * @template CO The target input type.
 */
export function higherOrderCompactMapInput<CI, CO extends CI>(
  fn: (
    input: CO & DefaultContext
  ) => Promise<CI & DefaultContext | undefined | null>
): Leaf.Transformer<CI, CO> {
  return async leaf => ({
    ...leaf,
    next: async input => {
      const newInput = await fn(input);

      if (newInput === undefined || newInput === null) {
        return undefined;
      }

      return leaf.next(newInput);
    }
  });
}

/**
 * Filter out falsy input and stop this leaf prematurely if the input does not
 * pass a condition.
 * @template CI The original input type.
 * @template CO The target input type.
 */
export function higherOrderFilterInput<CI, CO extends CI>(
  fn: (input: CO & DefaultContext) => Promise<boolean | undefined | null>
): Leaf.Transformer<CI, CO> {
  return higherOrderCompactMapInput(async input => {
    const passed = await fn(input);
    if (!passed) return undefined;
    return input;
  });
}
