/* istanbul ignore file */
import { joinObjects } from "../common/utils";
import { ContextDAO } from "../type/context-dao";

/** Create an in-memory context DAO store. This is useful for debugging */
export function createInMemoryContextDAO<Context>() {
  let storage: { [K: string]: { [K: string]: Context } } = {};

  const dao: ContextDAO<Context> = {
    getContext: async ({ targetPlatform: platform, targetID }) => {
      if (storage[platform] == null) storage[platform] = {};

      if (storage[platform][targetID] == null) {
        storage[platform][targetID] = {} as Context;
      }

      return storage[platform][targetID];
    },
    appendContext: async ({ context, targetPlatform, targetID }) => {
      const oldContext = await dao.getContext({ targetPlatform, targetID });
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
    ...dao,
    overrideStorage: async (customStorage: typeof storage) => {
      storage = customStorage;
    },
    resetStorage: async () => {
      storage = {};
    },
  };
}
