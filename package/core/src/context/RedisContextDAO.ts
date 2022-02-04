import { requireAllTruthy } from "@haipham/javascript-helper-preconditions";
import { createClient, RedisClient } from "redis";
import { joinObjects, promisify1, promisify2 } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";

export function createRedisContextDAO(
  redis: Pick<RedisClient, "get" | "set" | "del">
): ContextDAO {
  function getCacheKey(targetID: string, targetPlatform: AmbiguousPlatform) {
    return `${targetPlatform}-${targetID}`;
  }

  const get = promisify1(redis.get).bind(redis);
  const set = promisify2(redis.set).bind(redis);
  const del = promisify1(redis.del).bind(redis);

  const dao: ContextDAO = {
    getContext: async ({ targetPlatform: platform, targetID }) => {
      const context = await get(getCacheKey(targetID, platform));
      return JSON.parse(context);
    },
    appendContext: async ({
      additionalContext,
      oldContext,
      targetID,
      targetPlatform,
    }) => {
      if (oldContext == null) {
        oldContext = await dao.getContext({ targetID, targetPlatform });
      }

      const newContext = joinObjects(oldContext, additionalContext);

      await set(
        getCacheKey(targetID, targetPlatform),
        JSON.stringify(newContext)
      );

      return { newContext, oldContext };
    },
    resetContext: ({ targetPlatform: platform, targetID }) => {
      return del(getCacheKey(targetID, platform));
    },
  };

  return dao;
}

export default function createDefaultRedisContextDAO() {
  const { REDIS_HOST = "", REDIS_PORT = "" } = requireAllTruthy({
    REDIS_HOST: process.env["REDIS_HOST"],
    REDIS_PORT: process.env["REDIS_PORT"],
  });

  const redisClient = createClient({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT || "", undefined),
  });

  const contextDAO = createRedisContextDAO(redisClient);
  return { contextDAO, redisClient };
}
