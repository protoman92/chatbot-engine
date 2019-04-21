import { Context } from '../type/common';
import { ContextDAO } from '../type/context-dao';
import { SupportedPlatform } from '../type/messenger';

/**
 * Create an in-memory context DAO store. This is useful for debugging.
 * @template C The context used by the current chatbot.
 * @param platform The platform being used.
 * @return A context DAO instance.
 */
export function createInMemoryContextDAO<C extends Context>(
  platform: SupportedPlatform
): ContextDAO<C> {
  const storage: { [K: string]: C } = {};

  function getCacheKey(senderID: string) {
    return `${platform}-${senderID}`;
  }

  return {
    getContext: async senderID => {
      const cacheKey = getCacheKey(senderID);
      return storage[cacheKey] || {};
    },
    setContext: async (senderID, context) => {
      const cacheKey = getCacheKey(senderID);
      storage[cacheKey] = context;
    },
    resetAll: async () => {
      const keys = Object.keys(storage);
      keys.forEach(key => delete storage[key]);
    }
  };
}
