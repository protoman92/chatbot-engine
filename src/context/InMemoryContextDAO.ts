import { joinObjects } from "../common/utils";
import { ContextDAO } from "../type/context-dao";
import { SupportedPlatform } from "../type/messenger";

/**
 * Create an in-memory context DAO store. This is useful for debugging.
 * @template C The context used by the current chatbot.
 */
export function createInMemoryContextDAO<C>(): ContextDAO<C> {
  const storage: { [K: string]: C } = {};

  function getCacheKey(targetID: string, targetPlatform: SupportedPlatform) {
    return `${targetPlatform}-${targetID}`;
  }

  return {
    getContext: async (targetID, targetPlatform) => {
      const cacheKey = getCacheKey(targetID, targetPlatform);
      return storage[cacheKey] || ({} as C);
    },
    appendContext: async (targetID, targetPlatform, context) => {
      const cacheKey = getCacheKey(targetID, targetPlatform);
      storage[cacheKey] = joinObjects(storage[cacheKey], context);
    },
    resetContext: async () => {
      const keys = Object.keys(storage);
      keys.forEach(key => delete storage[key]);
    }
  };
}
