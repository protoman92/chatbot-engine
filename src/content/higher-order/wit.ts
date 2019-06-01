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
      try {
        return await leaf.next({ ...input, witEntities: {} });
      } catch (e) {
        const { entities: witEntities } = await comm.validate(input.inputText);
        return await leaf.next({ ...input, witEntities });
      }
    }
  });
}
