import expectJs from "expect.js";
import { describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify } from "ts-mockito";
import { createSubscription, NextResult } from "../../stream";
import { ErrorContext } from "../../type/common";
import { BaseLeaf } from "../../type/leaf";
import { createDefaultErrorLeaf, createLeafWithObserver } from "../leaf";
import { catchError } from "./catch-error";
import { createTransformChain } from "./transform-chain";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Transform chain", () => {
  it("Catch error should work correctly", async () => {
    // Setup
    const error = new Error("Something happened");

    const errorLeaf = spy<BaseLeaf<{}>>({
      next: () => Promise.reject(error),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {})),
    });

    const fallbackLeaf = spy<BaseLeaf<ErrorContext>>({
      next: () => Promise.resolve(NextResult.SUCCESS),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {})),
    });

    const transformed = await createTransformChain()
      .pipe(catchError(instance(fallbackLeaf)))
      .transform(instance(errorLeaf));

    // When
    const input = {
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      stickerID: "",
      a: 1,
      b: 2,
      error: new Error(""),
    };

    const nextResult = await transformed.next(input);
    await transformed.subscribe({ next: async () => NextResult.SUCCESS });
    await transformed.complete!();

    // Then
    verify(fallbackLeaf.next(deepEqual({ ...input, error }))).once();
    verify(fallbackLeaf.complete!()).once();
    verify(fallbackLeaf.subscribe(anything())).once();
    verify(errorLeaf.complete!()).once();
    verify(errorLeaf.subscribe(anything())).once;
    expectJs(nextResult).to.eql(NextResult.SUCCESS);
  });

  it("Create leaf with pipe chain", async () => {
    // Setup
    const trasformedLeaf: BaseLeaf<ErrorContext> = await createTransformChain()
      .pipe<{}>(async (leaf) => ({
        ...leaf,
        next: async (input) => {
          const previousResult = await leaf.next(input);

          switch (previousResult) {
            case NextResult.SUCCESS:
              return previousResult;

            case NextResult.FAILURE:
              throw new Error("some-error");
          }
        },
      }))
      .pipe(catchError(await createDefaultErrorLeaf()))
      .transform(
        await createLeafWithObserver(async (observer) => ({
          next: async ({ targetID, targetPlatform, ...input }) => {
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
        return NextResult.FAILURE;
      },
    });

    await trasformedLeaf.next({
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      stickerID: "",
      error: new Error(""),
    });

    // Then
    expectJs(valueDeliveredCount).to.eql(2);
  });
});
