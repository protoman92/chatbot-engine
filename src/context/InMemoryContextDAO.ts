import { joinObjects } from "../common/utils";
import { ContextDAO } from "../type/context-dao";
import { AmbiguousPlatform } from "../type/messenger";

/** Create an in-memory context DAO store. This is useful for debugging */
export function createInMemoryContextDAO<Context>(): ContextDAO<Context> {
  const storage: { [K: string]: Context } = {};

  function getCacheKey(targetID: string, targetPlatform: AmbiguousPlatform) {
    return `${targetPlatform}-${targetID}`;
  }

  return {
    getContext: async (targetID, targetPlatform) => {
      const cacheKey = getCacheKey(targetID, targetPlatform);
      return storage[cacheKey] || ({} as Context);
    },
    appendContext: async (targetID, targetPlatform, context) => {
      const cacheKey = getCacheKey(targetID, targetPlatform);
      storage[cacheKey] = joinObjects(storage[cacheKey], context);
    },
    resetContext: async () => {
      const keys = Object.keys(storage);
      keys.forEach((key) => delete storage[key]);
    },
  };
}
