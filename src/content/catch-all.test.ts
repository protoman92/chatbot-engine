import expectJs from "expect.js";
import { beforeEach, describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../stream";
import { AmbiguousLeaf } from "../type/leaf";
import { catchAll } from "./catch-all";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("catchAll higher order function", () => {
  interface Context {}
  let rootLeaf: AmbiguousLeaf<Context>;
  let catchHandler: Readonly<{ onCatchAll: Parameters<typeof catchAll>[0] }>;

  beforeEach(() => {
    rootLeaf = spy<AmbiguousLeaf<Context>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });

    catchHandler = spy<typeof catchHandler>({ onCatchAll: () => {} });
  });

  it("Should not catch all if root leaf does not fall through", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.BREAK);
    const transformer = await catchAll(instance(catchHandler).onCatchAll);
    const transformed = await transformer(instance(rootLeaf));

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" },
      type: "message_trigger",
    });

    // Then
    expectJs(result).to.eql(NextResult.BREAK);
    verify(catchHandler.onCatchAll(anything())).never();
  });

  it("Should not catch all if invalid request type", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.FALLTHROUGH);
    const transformer = await catchAll(instance(catchHandler).onCatchAll);
    const transformed = await transformer(instance(rootLeaf));

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      changedContext: {},
      input: { type: "placebo" },
      newContext: {},
      oldContext: {},
      type: "context_trigger",
    });

    // Then
    expectJs(result).to.eql(NextResult.FALLTHROUGH);
    verify(catchHandler.onCatchAll(anything())).never();
  });

  it("Should catch if if root leaf falls through", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.FALLTHROUGH);
    const transformer = await catchAll(instance(catchHandler).onCatchAll);
    const transformed = await transformer(instance(rootLeaf));

    // When
    const request = {
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" as const },
      type: "message_trigger" as const,
    };

    const result = await transformed.next(request);

    // Then
    expectJs(result).to.eql(NextResult.BREAK);
    verify(catchHandler.onCatchAll(deepEqual(request))).once();
  });
});
