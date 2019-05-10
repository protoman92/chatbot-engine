import { requireKeys } from '../../common/utils';
import { Leaf } from '../../type/leaf';
import { mapInput } from './map-input';

/**
 * Require keys in the input.
 * @param C The original context type.
 * @param keys The keys to be required.
 * @return A leaf transformer.
 */
export function requireInputKeys<C, K extends keyof C>(
  ...keys: readonly K[]
): Leaf.Transformer<C, C & Required<{ [K1 in K]: NonNullable<C[K1]> }>> {
  return mapInput(async context => requireKeys(context, ...keys));
}
