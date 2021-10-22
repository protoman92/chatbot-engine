/* istanbul ignore file */
import { merge } from "lodash";
import { joinObjects } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";
import { inspect } from "util";
import { createAsyncSynchronizer } from "@haipham/javascript-helper-async-synchronizer";

export type InMemoryContextData<Context> = {
  [K in AmbiguousPlatform]: { [K: string]: Context };
};

/** Create an in-memory context DAO store. This is useful for debugging */
function createInMemoryContextDAO<Context>() {
  const synchronizer = createAsyncSynchronizer();
  let storage: InMemoryContextData<Context> = { facebook: {}, telegram: {} };

  const getContext: ContextDAO<Context>["getContext"] = async ({
    targetID,
    targetPlatform,
  }) => {
    if (storage[targetPlatform][targetID] == null) {
      storage[targetPlatform][targetID] = {} as Context;
    }

    return storage[targetPlatform][targetID];
  };

  const baseDAO: ContextDAO<Context> = {
    getContext: synchronizer.synchronize(getContext),
    appendContext: synchronizer.synchronize(
      async ({ additionalContext, oldContext, targetPlatform, targetID }) => {
        if (oldContext == null) {
          oldContext = await getContext({ targetPlatform, targetID });
        }

        const newContext = joinObjects(oldContext, additionalContext);
        storage[targetPlatform][targetID] = newContext;
        return { oldContext, newContext };
      }
    ),
    resetContext: synchronizer.synchronize(
      async ({ targetID, targetPlatform }) => {
        delete storage[targetPlatform][targetID];
      }
    ),
  };

  const dao = {
    ...baseDAO,
    getAllContext: async () => {
      return storage;
    },
    overrideStorage: async (custom: typeof storage) => {
      storage = custom;
    },
    mergeStorage: async (additionalStorage: typeof storage) => {
      storage = merge(storage, additionalStorage);
    },
    resetStorage: async () => {
      for (const key in storage) {
        storage[key as keyof typeof storage] = {};
      }
    },
  };

  const finalDAO = {
    ...dao,
    contextDAO: dao,
    [inspect.custom]() {
      return JSON.stringify(storage, null, 4);
    },
  };

  return finalDAO;
}

export const inMemoryContextDAO = createInMemoryContextDAO();

export default function createDefaultInMemoryContextDAO<Context>() {
  return inMemoryContextDAO as ContextDAO<Context>;
}
