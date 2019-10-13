import { createClient, RedisClient } from "redis";
import {
  joinObjects,
  promisify1,
  promisify2,
  requireAllTruthy
} from "../common/utils";
import { ContextDAO } from "../type/context-dao";
import { SupportedPlatform } from "../type/messenger";

export function createRedisContextDAO<C>(
  redis: Pick<RedisClient, "get" | "set" | "del">
): ContextDAO<C> {
  function getCacheKey(targetID: string, targetPlatform: SupportedPlatform) {
    return `${targetPlatform}-${targetID}`;
  }

  const get = promisify1(redis.get).bind(redis);
  const set = promisify2(redis.set).bind(redis);
  const del = promisify1(redis.del).bind(redis);

  const contextDAO: ContextDAO<C> = {
    getContext: async (targetID, targetPlatform) => {
      const context = await get(getCacheKey(targetID, targetPlatform));
      return JSON.parse(context);
    },
    appendContext: async (targetID, targetPlatform, context) => {
      const oldContext = await contextDAO.getContext(targetID, targetPlatform);
      const newContext = joinObjects(oldContext, context);

      return set(
        getCacheKey(targetID, targetPlatform),
        JSON.stringify(newContext)
      );
    },
    resetContext: (targetID, targetPlatform) => {
      return del(getCacheKey(targetID, targetPlatform));
    }
  };

  return contextDAO;
}

export default function<C>() {
  const { REDIS_HOST = "", REDIS_PORT = "", REDIS_URI = "" } = process.env;
  requireAllTruthy({ REDIS_HOST, REDIS_PORT, REDIS_URI });

  const redisClient = createClient({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT || "", undefined),
    url: REDIS_URI
  });

  const contextDAO = createRedisContextDAO<C>(redisClient);
  return { contextDAO, redisClient };
}
