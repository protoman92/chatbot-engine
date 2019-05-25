import { RedisClient } from 'redis';
import { promisify1, promisify2 } from '../common/utils';
import { ContextDAO } from '../type/context-dao';
import { SupportedPlatform } from '../type/messenger';

export function createRedisContextDAO<C>(
  redis: Pick<RedisClient, 'get' | 'set' | 'del'>,
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
    setContext: (targetID, context) => {
      return promisifiedSet(getCacheKey(targetID), JSON.stringify(context));
    },
    resetContext: targetID => {
      return promisifiedDel(getCacheKey(targetID));
    }
  };

  return contextDAO;
}
