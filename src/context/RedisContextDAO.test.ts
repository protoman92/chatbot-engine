import expectJs from "expect.js";
import { beforeEach, describe } from "mocha";
import { RedisClient } from "redis";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { joinObjects } from "../common/utils";
import { createRedisContextDAO } from "./RedisContextDAO";
import { ContextDAO } from "../type/context-dao";

const targetID = "target-id";

describe("Redis context DAO", () => {
  let redis: Pick<RedisClient, "get" | "set" | "del">;
  let contextDAO: ContextDAO<{}>;

  function getCacheKey(targetID: string) {
    return `facebook-${targetID}`;
  }

  beforeEach(() => {
    redis = spy<Pick<RedisClient, "get" | "set" | "del">>({
      get: () => false,
      set: () => false,
      del: () => false
    });

    contextDAO = createRedisContextDAO(instance(redis), "facebook");
  });

  it("Should return context on get call", async () => {
    // Setup
    const context = { a: 1, b: 2 };

    when(redis.get(anything(), anything())).thenCall((param1, param2) => {
      param2(null, JSON.stringify(context));
    });

    // When
    const storedContext = await contextDAO.getContext(targetID);

    // Then
    verify(redis.get(getCacheKey(targetID), anything())).once();
    expectJs(storedContext).to.eql(context);
  });

  it("Should append context on set call", async () => {
    // Setup
    const oldContext = { a: 1, b: 2 };
    const additionalContext = { c: 3 };

    when(redis.get(anything(), anything())).thenCall((param1, param2) => {
      param2(null, JSON.stringify(oldContext));
    });

    when(redis.set(anything(), anything(), anything())).thenCall(
      (param1, param2, param3) => param3(null, "OK")
    );

    // When
    const result = await contextDAO.appendContext(targetID, additionalContext);

    // Then
    const finalContext = joinObjects<{}>(oldContext, additionalContext);

    verify(
      redis.set(getCacheKey(targetID), JSON.stringify(finalContext), anything())
    ).once();

    expectJs(result).to.equal("OK");
  });

  it("Should clear context on reset call", async () => {
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
