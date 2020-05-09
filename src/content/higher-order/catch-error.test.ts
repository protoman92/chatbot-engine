import expectJs from "expect.js";
import { describe, it } from "mocha";
import { capture, instance, spy } from "ts-mockito";
import { createSubscription, NextResult } from "../../stream";
import { AmbiguousLeaf } from "../../type";
import { createLeafWithObserver } from "../leaf";
import { catchError } from "./catch-error";

describe("catchError higher-order function", () => {
  const targetID = "target-id";
  const targetPlatform = "facebook" as const;

  it("Should add error to input if error is encountered", async () => {
    // Setup
    let fallbackLeaf = await createLeafWithObserver<{}>(async () => ({
      next: async () => NextResult.BREAK,
    }));

    fallbackLeaf = spy(fallbackLeaf);

    const leafToBeTransformed = await createLeafWithObserver(async () => ({
      next: async () => {
        throw new Error("");
      },
    }));

    const currentLeafName = "leaf_to_be_transformed";
    const transformer = await catchError(instance(fallbackLeaf));
    const transformed = await transformer(leafToBeTransformed);

    // When
    const result = await transformed.next({
      currentLeafName,
      targetID,
      targetPlatform,
      changedContext: {},
      currentContext: {},
      input: [{}],
      newContext: {},
      oldContext: {},
      type: "context_trigger",
    });

    // Then
    const [{ input, ...request }] = capture(fallbackLeaf.next).first();
    expectJs(result).to.eql(NextResult.BREAK);
    expectJs(request).to.have.property("currentLeafName", currentLeafName);
    expectJs(input).to.have.key("error");
    expectJs(input).to.have.property("erroredLeaf", currentLeafName);
  });

  it("Should get currentLeafName from error object if applicable", async () => {
    // Setup
    const overrideLeafName = "error_leaf_name";

    let fallbackLeaf = await createLeafWithObserver<{}>(async () => ({
      next: async () => NextResult.BREAK,
    }));

    fallbackLeaf = spy(fallbackLeaf);

    const leafToBeTransformed: AmbiguousLeaf<{}> = {
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
      changedContext: {},
      currentContext: {},
      currentLeafName: "should_be_ignored",
      input: [{}],
      newContext: {},
      oldContext: {},
      type: "context_trigger",
    });

    // Then
    const [{ input }] = capture(fallbackLeaf.next).first();
    expectJs(input).to.have.property("erroredLeaf", overrideLeafName);
  });
});
