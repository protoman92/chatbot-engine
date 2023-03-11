/* istanbul ignore file */
import { createAsyncSynchronizer } from "@haipham/javascript-helper-async-synchronizer";
import { merge } from "lodash";
import { inspect } from "util";
import { ChatbotContext } from "..";
import { joinObjects } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";

export type InMemoryContextData = {
  [K in AmbiguousPlatform]: { [K: string]: ChatbotContext };
};

/** Create an in-memory context DAO store. This is useful for debugging */
export function createInMemoryContextDAO() {
  const synchronizer = createAsyncSynchronizer();
  let storage: InMemoryContextData = { facebook: {}, telegram: {} };

  const getContext: ContextDAO["getContext"] = ({
    targetID,
    targetPlatform,
  }) => {
    if (storage[targetPlatform][targetID] == null) {
      storage[targetPlatform][targetID] = {} as ChatbotContext;
    }

    return Promise.resolve(storage[targetPlatform][targetID]!);
  };

  const baseDAO: ContextDAO = {
    getContext,
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
    resetContext: ({ targetID, targetPlatform }) => {
      delete storage[targetPlatform][targetID];
      return Promise.resolve(undefined);
    },
  };

  const dao = {
    ...baseDAO,
    getAllContext: async () => {
      return storage;
    },
    overrideStorage: (custom: typeof storage) => {
      storage = custom;
      return Promise.resolve(undefined);
    },
    mergeStorage: (additionalStorage: typeof storage) => {
      storage = merge(storage, additionalStorage);
      return Promise.resolve(undefined);
    },
    resetStorage: () => {
      for (const key in storage) {
        storage[key as keyof typeof storage] = {};
      }

      return Promise.resolve(undefined);
    },
  };

  return {
    ...dao,
    contextDAO: dao,
    [inspect.custom]() {
      return JSON.stringify(storage, null, 4);
    },
  };
}

export const inMemoryContextDAO = createInMemoryContextDAO();

export default function createDefaultInMemoryContextDAO() {
  return inMemoryContextDAO as ContextDAO;
}
