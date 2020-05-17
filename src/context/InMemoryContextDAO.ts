/* istanbul ignore file */
import { joinObjects } from "../common/utils";
import { ContextDAO } from "../type/context-dao";

/** Create an in-memory context DAO store. This is useful for debugging */
export function createInMemoryContextDAO<Context>() {
  let storage: { [K: string]: { [K: string]: Context } } = {};

  const contextDAO: ContextDAO<Context> = {
    getContext: async (targetID, targetPlatform) => {
      if (storage[targetPlatform] == null) {
        storage[targetPlatform] = {};
      }

      if (storage[targetPlatform][targetID] == null) {
        storage[targetPlatform][targetID] = {} as Context;
      }

      return storage[targetPlatform][targetID];
    },
    appendContext: async (targetID, targetPlatform, context) => {
      const oldContext = await contextDAO.getContext(targetID, targetPlatform);
      const newContext = joinObjects(oldContext, context);
      storage[targetPlatform][targetID] = newContext;
      return { oldContext, newContext };
    },
    resetContext: async () => {
      const keys = Object.keys(storage);
      keys.forEach((key) => delete storage[key]);
    },
  };

  return {
    ...contextDAO,
    overrideStorage: async (customStorage: typeof storage) => {
      storage = customStorage;
    },
    resetStorage: async () => {
      storage = {};
    },
  };
}
