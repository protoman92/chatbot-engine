import expectJs from "expect.js";
import { anything, deepEqual, instance, spy, verify } from "ts-mockito";
import { createSubscription, NextResult } from "../stream";
import { AmbiguousLeaf } from "../type/leaf";
import { catchError } from "./catch-error";
import { createDefaultErrorLeaf, createLeafWithObserver } from "./leaf";
import { createTransformChain } from "./transform-chain";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Transform chain", () => {
  it("Catching error in transform chain should work correctly", async () => {
    // Setup
    const error = new Error("Something happened");
    const erroredLeafName = "error_leaf";

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
      currentLeafName: erroredLeafName,
      input: {
        error: new Error("This error should be ignored"),
        erroredLeaf: "",
        type: "error",
      },
      type: "manual_trigger",
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
          currentLeafName: erroredLeafName,
          input: { error, erroredLeaf: erroredLeafName, type: "error" },
          type: "manual_trigger",
        })
      )
    ).once();

    verify(fallbackLeaf.complete!()).once();
    verify(fallbackLeaf.subscribe(anything())).once();
    verify(errorLeaf.complete!()).once();
    verify(errorLeaf.subscribe(anything())).once;
    expectJs(nextResult).to.eql(NextResult.BREAK);
  });

  it("Leaf with pipe chain should trigger all wrapped leaves", async () => {
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
      .pipe(
        catchError(
          await createDefaultErrorLeaf({
            formatErrorMessage: ({ message }) => message,
          })
        )
      )
      .transform(
        await createLeafWithObserver(async (observer) => ({
          next: async ({ targetID, targetPlatform, input }) => {
            const text = (input as { text: string }).text;

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
      currentLeafName: "",
      input: { text: "", type: "text" },
      type: "message_trigger",
    });

    // Then
    expectJs(valueDeliveredCount).to.eql(2);
  });
});
