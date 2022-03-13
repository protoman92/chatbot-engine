import { capture, instance, spy } from "ts-mockito";
import { createSubscription, NextResult } from "../stream";
import { AmbiguousLeaf } from "../type";
import { catchError } from "./catch-error";
import { createLeaf } from "./leaf";

describe("catchError higher-order function", () => {
  const targetID = "target-id";
  const targetPlatform = "facebook" as const;

  it("Should add error to input if error is encountered", async () => {
    // Setup
    let fallbackLeaf = await createLeaf(() => ({
      next: async () => NextResult.BREAK,
    }));

    fallbackLeaf = spy(fallbackLeaf);

    const leafToBeTransformed = await createLeaf(() => ({
      next: async () => {
        throw new Error("");
      },
    }));

    const currentLeafName = "leaf_to_be_transformed";
    const transformer = catchError(instance(fallbackLeaf));
    const transformed = await transformer(leafToBeTransformed);

    // When
    const result = await transformed.next({
      currentLeafName,
      targetID,
      targetPlatform,
      currentContext: {},
      input: {
        changedContext: {},
        newContext: {},
        oldContext: {},
        type: "context_change",
      },
      triggerType: "manual",
    });

    // Then
    const [{ input, ...request }] = capture(fallbackLeaf.next).first();
    expect(result).toEqual(NextResult.BREAK);
    expect(request).toHaveProperty("currentLeafName", currentLeafName);
    expect(input).toHaveProperty("error");
    expect(input).toHaveProperty("erroredLeaf", currentLeafName);
  });

  it("Should get currentLeafName from error object if applicable", async () => {
    // Setup
    const overrideLeafName = "error_leaf_name";

    let fallbackLeaf = await createLeaf(() => ({
      next: async () => NextResult.BREAK,
    }));

    fallbackLeaf = spy(fallbackLeaf);

    const leafToBeTransformed: AmbiguousLeaf = {
      next: async () => {
        const error: any = new Error("");
        error.currentLeafName = overrideLeafName;
        throw error;
      },
      subscribe: async () => createSubscription(async () => {}),
    };

    const transformer = await catchError(instance(fallbackLeaf));
    const transformed = await transformer(leafToBeTransformed);

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "should_be_ignored",
      input: {
        changedContext: {},
        newContext: {},
        oldContext: {},
        type: "context_change",
      },
      triggerType: "manual",
    });

    // Then
    const [{ input }] = capture(fallbackLeaf.next).first();
    expect(input).toHaveProperty("erroredLeaf", overrideLeafName);
  });
});
