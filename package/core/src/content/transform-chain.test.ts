import { anything, deepEqual, instance, spy, verify } from "ts-mockito";
import { createSubscription, NextResult } from "../stream";
import { AmbiguousLeaf, FacebookRawRequest } from "../type";
import { catchError } from "./catch-error";
import { createDefaultErrorLeaf, createLeaf } from "./leaf";
import { createTransformChain } from "./transform-chain";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Transform chain", () => {
  it("Catching error in transform chain should work correctly", async () => {
    // Setup
    const error = new Error("Something happened");
    const erroredLeafName = "error_leaf";

    const errorLeaf = spy<AmbiguousLeaf<{}>>({
      next: () => {
        return Promise.reject(error);
      },
      complete: () => {
        return Promise.resolve({});
      },
      subscribe: () => {
        return Promise.resolve(createSubscription(async () => {}));
      },
    });

    const fallbackLeaf = spy<AmbiguousLeaf<{}>>({
      next: () => {
        return Promise.resolve(NextResult.BREAK);
      },
      complete: () => {
        return Promise.resolve({});
      },
      subscribe: () => {
        return Promise.resolve(createSubscription(async () => {}));
      },
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

    await transformed.subscribe({
      next: async () => {
        return NextResult.BREAK;
      },
    });

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
    expect(nextResult).toEqual(NextResult.BREAK);
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
            formatErrorMessage: ({ message }) => {
              return message;
            },
          })
        )
      )
      .transform(
        await createLeaf(async (observer) => ({
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
      rawRequest: {} as FacebookRawRequest,
      type: "message_trigger",
    });

    // Then
    expect(valueDeliveredCount).toEqual(2);
  });
});
