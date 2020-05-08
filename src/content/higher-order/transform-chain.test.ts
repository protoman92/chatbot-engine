import expectJs from "expect.js";
import { describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify } from "ts-mockito";
import { createSubscription, NextResult } from "../../stream";
import {} from "../../type/common";
import { AmbiguousLeaf } from "../../type/leaf";
import { createDefaultErrorLeaf, createLeafWithObserver } from "../leaf";
import { catchError } from "./catch-error";
import { createTransformChain } from "./transform-chain";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Transform chain", () => {
  it("Catch error should work correctly", async () => {
    // Setup
    const error = new Error("Something happened");

    const errorLeaf = spy<AmbiguousLeaf<{}>>({
      next: () => Promise.reject(error),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {})),
    });

    const fallbackLeaf = spy<AmbiguousLeaf<{}>>({
      next: () => Promise.resolve(NextResult.BREAK),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {})),
    });

    const transformed = await createTransformChain()
      .pipe(catchError(instance(fallbackLeaf)))
      .transform(instance(errorLeaf));

    // When
    const nextResult = await transformed.next({
      targetID,
      targetPlatform,
      currentContext: { a: 1, b: 2 },
      input: { error: new Error("This error should be ignored") },
      type: "message_trigger",
    });

    await transformed.subscribe({ next: async () => NextResult.BREAK });
    await transformed.complete!();

    // Then
    verify(
      fallbackLeaf.next(
        deepEqual({
          targetID,
          targetPlatform,
          currentContext: { a: 1, b: 2 },
          input: { error },
          type: "message_trigger",
        })
      )
    ).once();

    verify(fallbackLeaf.complete!()).once();
    verify(fallbackLeaf.subscribe(anything())).once();
    verify(errorLeaf.complete!()).once();
    verify(errorLeaf.subscribe(anything())).once;
    expectJs(nextResult).to.eql(NextResult.BREAK);
  });

  it("Create leaf with pipe chain", async () => {
    // Setup
    const trasformedLeaf: AmbiguousLeaf<{}> = await createTransformChain()
      .pipe<{}>(async (leaf) => ({
        ...leaf,
        next: async (request) => {
          const previousResult = await leaf.next(request);

          switch (previousResult) {
            case NextResult.BREAK:
              return previousResult;

            case NextResult.FALLTHROUGH:
              throw new Error("some-error");
          }
        },
      }))
      .pipe(catchError(await createDefaultErrorLeaf()))
      .transform(
        await createLeafWithObserver(async (observer) => ({
          next: async ({ targetID, targetPlatform, input }) => {
            const text = (input as { inputText: string }).inputText;

            return observer.next({
              targetID,
              targetPlatform,
              output: [{ content: { text, type: "text" } }],
            });
          },
        }))
      );

    // When
    let valueDeliveredCount = 0;

    trasformedLeaf.subscribe({
      next: async () => {
        valueDeliveredCount += 1;
        /** Make sure the pipe transformer gets invoked */
        return NextResult.FALLTHROUGH;
      },
    });

    await trasformedLeaf.next({
      targetID,
      targetPlatform,
      currentContext: { error: new Error("") },
      input: {},
      type: "message_trigger",
    });

    // Then
    expectJs(valueDeliveredCount).to.eql(2);
  });
});
