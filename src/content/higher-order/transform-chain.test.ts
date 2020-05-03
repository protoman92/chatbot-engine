import expectJs from "expect.js";
import { describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify } from "ts-mockito";
import { DEFAULT_COORDINATES } from "../../common/utils";
import { createSubscription } from "../../stream";
import { ErrorContext } from "../../type/common";
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

    const fallbackLeaf = spy<AmbiguousLeaf<ErrorContext>>({
      next: () => Promise.resolve({}),
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
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: "",
      a: 1,
      b: 2,
      error: new Error(""),
    };

    const nextResult = await transformed.next(input);
    await transformed.subscribe({ next: async () => ({}) });
    await transformed.complete!();

    // Then
    verify(fallbackLeaf.next(deepEqual({ ...input, error }))).once();
    verify(fallbackLeaf.complete!()).once();
    verify(fallbackLeaf.subscribe(anything())).once();
    verify(errorLeaf.complete!()).once();
    verify(errorLeaf.subscribe(anything())).once;
    expectJs(nextResult).to.eql({});
  });

  it("Create leaf with pipe chain", async () => {
    // Setup
    const baseLeaf = await createLeafWithObserver(async (observer) => ({
      next: async ({ inputText: text, targetID, targetPlatform }) => {
        return observer.next({
          targetID,
          targetPlatform,
          output: [{ content: { text, type: "text" } }],
        });
      },
    }));

    const trasformed = await createTransformChain()
      .forContextOfType<{}>()
      .pipe<{}>(async (leaf) => ({
        ...leaf,
        next: async (input) => {
          const previousResult = await leaf.next(input);
          if (!!previousResult) throw new Error("some-error");
          return undefined;
        },
      }))
      .pipe(catchError(await createDefaultErrorLeaf()))
      .transform(baseLeaf);

    // When
    let valueDeliveredCount = 0;

    trasformed.subscribe({
      next: async () => {
        valueDeliveredCount += 1;
        return {};
      },
    });

    await trasformed.next({
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: "",
      error: new Error(""),
    });

    // Then
    expectJs(valueDeliveredCount).to.eql(2);
  });
});
