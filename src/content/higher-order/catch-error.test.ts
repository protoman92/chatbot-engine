import expectJs from "expect.js";
import { describe, it } from "mocha";
import { capture, instance, spy } from "ts-mockito";
import { NextResult } from "../../stream";
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

    leafToBeTransformed.name = "LeafToBeTransformed";
    const transformer = await catchError(instance(fallbackLeaf));
    const transformed = await transformer(leafToBeTransformed);

    // When
    const result = await transformed.next({
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
    const [{ input }] = capture(fallbackLeaf.next).first();
    expectJs(result).to.eql(NextResult.BREAK);
    expectJs(input).to.have.key("error");
    expectJs(input).to.have.property("erroredLeaf", leafToBeTransformed.name);
  });
});
