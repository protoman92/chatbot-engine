import { requireKeys } from '../../common/utils';
import { Leaf } from '../../type/leaf';
import { mapContext } from './map-context';

/**
 * Require keys in old context.
 * @param C The original context type.
 * @param keys The keys to be required.
 * @return A leaf transformer.
 */
export function requireContextKeys<C, K extends keyof C>(
  ...keys: readonly K[]
): Leaf.Transformer<C, C & Required<{ [K1 in K]: NonNullable<C[K1]> }>> {
  return mapContext(async context => requireKeys(context, ...keys));
}
