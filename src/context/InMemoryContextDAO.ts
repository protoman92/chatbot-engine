/* istanbul ignore file */
import { joinObjects } from "../common/utils";
import { ContextDAO } from "../type/context-dao";

/** Create an in-memory context DAO store. This is useful for debugging */
function createInMemoryContextDAO<Context>() {
  let storage: { [K: string]: { [K: string]: Context } } = {};

  const baseDAO: ContextDAO<Context> = {
    getContext: async ({ targetPlatform: platform, targetID }) => {
      if (storage[platform] == null) storage[platform] = {};

      if (storage[platform][targetID] == null) {
        storage[platform][targetID] = {} as Context;
      }

      return storage[platform][targetID];
    },
    appendContext: async ({ context, targetPlatform, targetID }) => {
      const oldContext = await baseDAO.getContext({ targetPlatform, targetID });
      const newContext = joinObjects(oldContext, context);
      storage[targetPlatform][targetID] = newContext;
      return { oldContext, newContext };
    },
    resetContext: async () => {
      const keys = Object.keys(storage);
      keys.forEach((key) => delete storage[key]);
    },
  };

  const dao = {
    ...baseDAO,
    getAllContext: async () => storage,
    overrideStorage: async (custom: typeof storage) => (storage = custom),
    resetStorage: async () => (storage = {}),
  };

  return { ...dao, contextDAO: dao };
}

export const inMemoryContextDAO = createInMemoryContextDAO();

export default function <Context>() {
  return inMemoryContextDAO as ContextDAO<Context>;
}
