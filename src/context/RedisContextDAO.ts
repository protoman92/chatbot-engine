import { createClient, RedisClient } from "redis";
import {
  joinObjects,
  promisify1,
  promisify2,
  requireAllTruthy,
} from "../common/utils";
import { ContextDAO } from "../type/context-dao";
import { AmbiguousPlatform } from "../type/messenger";

export function createRedisContextDAO<Context>(
  redis: Pick<RedisClient, "get" | "set" | "del">
): ContextDAO<Context> {
  function getCacheKey(targetID: string, targetPlatform: AmbiguousPlatform) {
    return `${targetPlatform}-${targetID}`;
  }

  const get = promisify1(redis.get).bind(redis);
  const set = promisify2(redis.set).bind(redis);
  const del = promisify1(redis.del).bind(redis);

  const dao: ContextDAO<Context> = {
    getContext: async ({ targetPlatform: platform, targetID }) => {
      const context = await get(getCacheKey(targetID, platform));
      return JSON.parse(context);
    },
    appendContext: async ({ context, targetID, targetPlatform }) => {
      const oldContext = await dao.getContext({ targetID, targetPlatform });
      const newContext = joinObjects(oldContext, context);

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

export default function<Context>() {
  const { REDIS_HOST = "", REDIS_PORT = "" } = process.env;
  requireAllTruthy({ REDIS_HOST, REDIS_PORT });

  const redisClient = createClient({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT || "", undefined),
  });

  const contextDAO = createRedisContextDAO<Context>(redisClient);
  return { contextDAO, redisClient };
}
