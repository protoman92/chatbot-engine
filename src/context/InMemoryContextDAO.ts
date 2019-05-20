import { ContextDAO } from '../type/context-dao';
import { SupportedPlatform } from '../type/messenger';

/**
 * Create an in-memory context DAO store. This is useful for debugging.
 * @template C The context used by the current chatbot.
 */
export function createInMemoryContextDAO<C>(
  platform: SupportedPlatform
): ContextDAO<C> {
  const storage: { [K: string]: C } = {};

  function getCacheKey(senderID: string) {
    return `${platform}-${senderID}`;
  }

  return {
    getContext: async senderID => {
      const cacheKey = getCacheKey(senderID);
      return storage[cacheKey] || ({} as C);
    },
    setContext: async (senderID, context) => {
      const cacheKey = getCacheKey(senderID);
      storage[cacheKey] = context;
    },
    resetContext: async () => {
      const keys = Object.keys(storage);
      keys.forEach(key => delete storage[key]);
    }
  };
}
