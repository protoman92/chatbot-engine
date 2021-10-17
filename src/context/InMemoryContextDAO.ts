/* istanbul ignore file */
import { joinObjects } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";

export type InMemoryContextData<Context> = {
  [K in AmbiguousPlatform]: { [K: string]: Context };
};

/** Create an in-memory context DAO store. This is useful for debugging */
function createInMemoryContextDAO<Context>() {
  let storage: InMemoryContextData<Context> = { facebook: {}, telegram: {} };

  const baseDAO: ContextDAO<Context> = {
    getContext: async ({ targetPlatform: platform, targetID }) => {
      if (storage[platform][targetID] == null) {
        storage[platform][targetID] = {} as Context;
      }

      return storage[platform][targetID];
    },
    appendContext: async ({
      additionalContext,
      oldContext,
      targetPlatform,
      targetID,
    }) => {
      if (oldContext == null) {
        oldContext = await baseDAO.getContext({ targetPlatform, targetID });
      }

      const newContext = joinObjects(oldContext, additionalContext);
      storage[targetPlatform][targetID] = newContext;
      return { oldContext, newContext };
    },
    resetContext: async ({ targetID, targetPlatform }) => {
      delete storage[targetPlatform][targetID];
    },
  };

  const dao = {
    ...baseDAO,
    getAllContext: async () => {
      return storage;
    },
    overrideStorage: async (custom: typeof storage) => {
      storage = custom;
    },
    resetStorage: async () => {
      for (const key in storage) {
        storage[key as keyof typeof storage] = {};
      }
    },
  };

  return { ...dao, contextDAO: dao };
}

export const inMemoryContextDAO = createInMemoryContextDAO();

export default function createDefaultInMemoryContextDAO<Context>() {
  return inMemoryContextDAO as ContextDAO<Context>;
}
