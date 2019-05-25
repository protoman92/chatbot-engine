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

  function getCacheKey(targetID: string) {
    return `${platform}-${targetID}`;
  }

  return {
    getContext: async targetID => {
      const cacheKey = getCacheKey(targetID);
      return storage[cacheKey] || ({} as C);
    },
    setContext: async (targetID, context) => {
      const cacheKey = getCacheKey(targetID);
      storage[cacheKey] = context;
    },
    resetContext: async () => {
      const keys = Object.keys(storage);
      keys.forEach(key => delete storage[key]);
    }
  };
}
