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
  redis: Pick<RedisClient, "get" | "set" | "del">,
  platform: SupportedPlatform
): ContextDAO<C> {
  function getCacheKey(targetID: string) {
    return `${platform}-${targetID}`;
  }

  const promisifiedGet = promisify1(redis.get).bind(redis);
  const promisifiedSet = promisify2(redis.set).bind(redis);
  const promisifiedDel = promisify1(redis.del).bind(redis);

  const contextDAO: ContextDAO<C> = {
    getContext: async targetID => {
      const context = await promisifiedGet(getCacheKey(targetID));
      return JSON.parse(context);
    },
    appendContext: async (targetID, context) => {
      const oldContext = await contextDAO.getContext(targetID);
      const newContext = joinObjects(oldContext, context);
      return promisifiedSet(getCacheKey(targetID), JSON.stringify(newContext));
    },
    resetContext: targetID => {
      return promisifiedDel(getCacheKey(targetID));
    }
  };

  return contextDAO;
}

export default function<C>() {
  return (platform: SupportedPlatform) => {
    const { REDIS_HOST = "", REDIS_PORT = "", REDIS_URI = "" } = process.env;
    requireAllTruthy({ REDIS_HOST, REDIS_PORT, REDIS_URI });

    const redisClient = createClient({
      host: REDIS_HOST,
      port: parseInt(REDIS_PORT || "", undefined),
      url: REDIS_URI
    });

    return createRedisContextDAO<C>(redisClient, platform);
  };
}
