import { ContextDAO, joinObjects } from "@haipham/chatbot-engine-core";
import { RedisClient } from "redis";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { createRedisContextDAO } from ".";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Redis context DAO", () => {
  let redis: Pick<RedisClient, "get" | "set" | "del">;
  let contextDAO: ContextDAO;

  function getCacheKey(targetID: string) {
    return `facebook-${targetID}`;
  }

  beforeEach(() => {
    redis = spy<Pick<RedisClient, "get" | "set" | "del">>({
      get: () => false,
      set: () => false,
      del: () => false,
    });

    contextDAO = createRedisContextDAO(instance(redis));
  });

  it("Should return context on get call", async () => {
    // Setup
    const context = { a: 1, b: 2 };

    when(redis.get(anything(), anything())).thenCall((...[, param2]) => {
      param2(null, JSON.stringify(context));
    });

    // When
    const storedContext = await contextDAO.getContext({
      targetID,
      targetPlatform,
    });

    // Then
    verify(redis.get(getCacheKey(targetID), anything())).once();
    expect(storedContext).toEqual(context);
  });

  it("Should append context on set call", async () => {
    // Setup
    const oldContext = { a: 1, b: 2 };
    const additionalContext = { c: 3 };

    when(redis.get(anything(), anything())).thenCall((...[, param2]) => {
      param2(null, JSON.stringify(oldContext));
    });

    when(
      redis.set(anything(), anything(), anything())
    ).thenCall((...[, , param3]) => param3(null, "OK"));

    // When
    const result = await contextDAO.appendContext({
      additionalContext,
      targetID,
      targetPlatform,
    });

    // Then
    const newContext = joinObjects<{}>(oldContext, additionalContext);
    const cacheKey = getCacheKey(targetID);
    verify(redis.set(cacheKey, JSON.stringify(newContext), anything())).once();
    expect(result).toEqual({ newContext, oldContext });
  });

  it("Should clear context on reset call", async () => {
    // Setup
    when(redis.del(anything(), anything())).thenCall((...[, param2]) => {
      param2(null, true);
    });

    // When
    const result = await contextDAO.resetContext({ targetID, targetPlatform });

    // Then
    verify(redis.del(getCacheKey(targetID), anything())).once();
    expect(result).toEqual(true);
  });
});
