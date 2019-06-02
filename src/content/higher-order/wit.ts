import { isNullOrUndefined } from 'util';
import { Leaf } from '../../type/leaf';
import { WitCommunicator, WitContext } from '../../type/wit';

/**
 * Retry a failing message with wit, by running the input text through wit
 * engine and injecting entities into leaf input.
 * @template C The original input type.
 */
export function higherOrderRetryWithWit<C>(
  comm: WitCommunicator
): Leaf.Transformer<C & WitContext, C> {
  return async leaf => ({
    ...leaf,
    next: async input => {
      const result = await leaf.next({ ...input, witEntities: {} });

      if (isNullOrUndefined(result)) {
        const { entities: witEntities } = await comm.validate(input.inputText);
        return leaf.next({ ...input, witEntities });
      }

      return result;
    }
  });
}
