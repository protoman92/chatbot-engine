import { RedisClient } from 'redis';
import { promisify1, promisify2 } from '../common/utils';
import { ContextDAO } from '../type/context-dao';
import { SupportedPlatform } from '../type/messenger';

export function createRedisContextDAO<C>(
  redis: Pick<RedisClient, 'get' | 'set' | 'del'>,
  platform: SupportedPlatform
): ContextDAO<C> {
  function getCacheKey(senderID: string) {
    return `${platform}-${senderID}`;
  }

  const promisifiedGet = promisify1(redis.get).bind(redis);
  const promisifiedSet = promisify2(redis.set).bind(redis);
  const promisifiedDel = promisify1(redis.del).bind(redis);

  const contextDAO: ContextDAO<C> = {
    getContext: async senderID => {
      const context = await promisifiedGet(getCacheKey(senderID));
      return JSON.parse(context);
    },
    setContext: (senderID, context) => {
      return promisifiedSet(getCacheKey(senderID), JSON.stringify(context));
    },
    resetContext: senderID => {
      return promisifiedDel(getCacheKey(senderID));
    }
  };

  return contextDAO;
}
