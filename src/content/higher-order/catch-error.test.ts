import expectJs from "expect.js";
import { describe, it } from "mocha";
import { NextResult } from "../../stream";
import { ErrorContext } from "../../type/common";
import { createLeafWithObserver } from "../leaf";
import { catchError } from "./catch-error";

describe("catchError higher-order function", () => {
  const targetID = "target-id";
  const targetPlatform = "facebook" as const;

  it("Should fallthrough if currentContext is not available", async () => {
    // Setup
    const fallbackLeaf = await createLeafWithObserver<ErrorContext>(
      async () => ({ next: async () => NextResult.BREAK })
    );

    const transformer = await catchError(fallbackLeaf);
    const transformed = await transformer(fallbackLeaf);

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      changedContext: {},
      input: [{}],
      newContext: {},
      oldContext: {},
    });

    // Then
    expectJs(result).to.eql(NextResult.FALLTHROUGH);
  });
});
