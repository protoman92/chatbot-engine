import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../stream";
import { AmbiguousLeaf, FacebookRawRequest } from "../type";
import { catchAll } from "./catch-all";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("catchAll higher order function", () => {
  let rootLeaf: AmbiguousLeaf;
  let catchHandler: Readonly<{ onCatchAll: Parameters<typeof catchAll>[0] }>;

  beforeEach(() => {
    rootLeaf = spy<AmbiguousLeaf>({
      next: () => {
        return Promise.reject("");
      },
      subscribe: () => {
        return Promise.reject("");
      },
    });

    catchHandler = spy<typeof catchHandler>({ onCatchAll: () => {} });
  });

  it("Should not catch all if root leaf does not fall through", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenReturn(NextResult.BREAK);
    const transformer = await catchAll(instance(catchHandler).onCatchAll);
    const transformed = await transformer(instance(rootLeaf));

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      rawRequest: {} as FacebookRawRequest,
      input: { text: "", type: "text" },
      triggerType: "message",
    });

    // Then
    expect(result).toEqual(NextResult.BREAK);
    verify(catchHandler.onCatchAll(anything())).never();
  });

  it("Should not catch all if invalid request type", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenReturn(NextResult.FALLTHROUGH);
    const transformer = await catchAll(instance(catchHandler).onCatchAll);
    const transformed = await transformer(instance(rootLeaf));

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: {
        changedContext: {},
        newContext: {},
        oldContext: {},
        type: "context_change",
      },
      triggerType: "manual",
    });

    // Then
    expect(result).toEqual(NextResult.FALLTHROUGH);
    verify(catchHandler.onCatchAll(anything())).never();
  });

  it("Should catch if if root leaf falls through", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenReturn(NextResult.FALLTHROUGH);
    const transformer = await catchAll(instance(catchHandler).onCatchAll);
    const transformed = await transformer(instance(rootLeaf));

    // When
    const genericRequest = {
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" as const },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message" as const,
    };

    const result = await transformed.next(genericRequest);

    // Then
    expect(result).toEqual(NextResult.BREAK);
    verify(catchHandler.onCatchAll(deepEqual(genericRequest))).once();
  });
});
