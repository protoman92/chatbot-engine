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

  const contextDAO: ContextDAO<Context> = {
    getContext: async (targetID, targetPlatform) => {
      const context = await get(getCacheKey(targetID, targetPlatform));
      return JSON.parse(context);
    },
    appendContext: async (targetID, targetPlatform, context) => {
      const oldContext = await contextDAO.getContext(targetID, targetPlatform);
      const newContext = joinObjects(oldContext, context);

      await set(
        getCacheKey(targetID, targetPlatform),
        JSON.stringify(newContext)
      );

      return { newContext, oldContext };
    },
    resetContext: (targetID, targetPlatform) => {
      return del(getCacheKey(targetID, targetPlatform));
    },
  };

  return contextDAO;
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
