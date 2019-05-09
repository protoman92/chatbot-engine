import { Leaf } from '../../type/leaf';
import { WitCommunicator, WitContext } from '../../type/wit';

/**
 * Retry a failing message with wit, by running the input text through wit
 * engine and injecting entities into leaf input.
 * @template C The context type used by the chatbot.
 * @param comm A HTTP communicator instance.
 * @param param1 The wit configurations.
 * @return A leaf transformer.
 */
export function useWitEngine<C>(
  comm: WitCommunicator
): Leaf.Transformer<C & WitContext, C> {
  return leaf => ({
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
