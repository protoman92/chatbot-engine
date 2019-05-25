import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { RedisClient } from 'redis';
import { anything, instance, spy, verify, when } from 'ts-mockito';
import { createRedisContextDAO } from '../../src/context/RedisContextDAO';
import { KV } from '../../src/type/common';
import { ContextDAO } from '../../src/type/context-dao';

const targetID = 'target-id';

describe('Redis context DAO', () => {
  interface Context extends KV<unknown> {}

  let redis: Pick<RedisClient, 'get' | 'set' | 'del'>;
  let contextDAO: ContextDAO<Context>;

  function getCacheKey(targetID: string) {
    return `facebook-${targetID}`;
  }

  beforeEach(() => {
    redis = spy<Pick<RedisClient, 'get' | 'set' | 'del'>>({
      get: (...params) => false,
      set: (...params: any[]) => false,
      del: (...params: any[]) => false
    });

    contextDAO = createRedisContextDAO(instance(redis), 'facebook');
  });

  it('Should return context on get call', async () => {
    // Setup
    const context: Context = { a: 1, b: 2 };

    when(redis.get(anything(), anything())).thenCall((param1, param2) => {
      param2(null, JSON.stringify(context));
    });

    // When
    const storedContext = await contextDAO.getContext(targetID);

    // Then
    verify(redis.get(getCacheKey(targetID), anything())).once();
    expectJs(storedContext).to.eql(context);
  });

  it('Should set context on set call', async () => {
    // Setup
    const context: Context = { a: 1, b: 2 };

    when(redis.set(anything(), anything(), anything())).thenCall(
      (param1, param2, param3) => param3(null, 'OK')
    );

    // When
    const result = await contextDAO.setContext(targetID, context);

    // Then
    verify(
      redis.set(getCacheKey(targetID), JSON.stringify(context), anything())
    ).once();

    expectJs(result).to.equal('OK');
  });

  it('Should clear context on reset call', async () => {
    // Setup
    when(redis.del(anything(), anything())).thenCall((param1, param2) => {
      param2(null, true);
    });

    // When
    const result = await contextDAO.resetContext(targetID);

    // Then
    verify(redis.del(getCacheKey(targetID), anything())).once();
    expectJs(result).to.equal(true);
  });
});
