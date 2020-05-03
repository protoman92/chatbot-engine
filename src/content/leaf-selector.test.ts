import expectJs from "expect.js";
import { beforeEach, describe } from "mocha";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { DEFAULT_COORDINATES } from "../common/utils";
import { NextResult } from "../stream";
import { AmbiguousLeaf, LeafEnumeration } from "../type/leaf";
import { createLeafWithObserver } from "./leaf";
import { createLeafSelector } from "./leaf-selector";

type TestLeafSelector = ReturnType<
  typeof import("./leaf-selector")["createLeafSelector"]
>;

const targetID = "target-id";
const targetPlatform = "facebook";

describe("Leaf selector", () => {
  interface Context {}

  let currentLeaf: AmbiguousLeaf<Context>;
  let selector: TestLeafSelector;

  beforeEach(async () => {
    currentLeaf = spy<AmbiguousLeaf<Context>>(
      await createLeafWithObserver(async () => ({
        checkTextConditions: () => Promise.reject(""),
        checkContextConditions: () => Promise.reject(""),
        next: () => Promise.reject(""),
        complete: () => Promise.reject(""),
      }))
    );

    selector = spy<TestLeafSelector>(createLeafSelector({}));
  });

  it("Selecting leaf should stop at first leaf that passes", async () => {
    // Setup
    const iteration = 1000;
    const validLeafID = 500;

    const enumeratedLeaves: LeafEnumeration<Context>[] = [
      ...Array(iteration).keys(),
    ].map((i) => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: [],
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    when(selector.triggerLeaf(anything(), anything())).thenCall(
      async ({ currentLeafID }) => {
        if (currentLeafID === `${validLeafID}`) return NextResult.SUCCESS;
        return NextResult.FAILURE;
      }
    );

    // When
    await instance(selector).next({
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: "",
    });

    // Then
    verify(selector.triggerLeaf(anything(), anything())).times(validLeafID + 1);
  });

  it("Completing stream should trigger complete from all leaves", async () => {
    // Setup
    let completedCount = 0;

    const enumeratedLeaves: LeafEnumeration<Context>[] = [
      ...Array(1000).keys(),
    ].map((i) => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: [],
    }));

    !!currentLeaf.complete &&
      when(currentLeaf.complete()).thenCall(async () => {
        completedCount += 1;
      });

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(selector).complete();

    // Then
    expectJs(completedCount).to.equal(enumeratedLeaves.length);
  });

  it("Subscribing to response should merge leaf observables", async () => {
    // Setup
    const enumeratedLeaves: LeafEnumeration<Context>[] = [
      ...Array(1000).keys(),
    ].map((i) => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: [],
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(selector).subscribe({
      next: async () => NextResult.SUCCESS,
    });

    // Then
    verify(currentLeaf.subscribe(anything())).times(enumeratedLeaves.length);
  });

  it("Subscribing should increase subscribe count", async () => {
    // Setup && When
    await instance(selector).subscribe({
      next: async () => NextResult.SUCCESS,
    });

    try {
      await instance(selector).subscribe({
        next: async () => NextResult.SUCCESS,
      });

      expectJs().fail("Should have failed");
    } catch {}
  });

  it("Should throw error if no enumerated leaves found", async () => {
    // Setup
    when(selector.enumerateLeaves()).thenResolve([]);

    when(selector.triggerLeaf(anything(), anything())).thenResolve(
      NextResult.SUCCESS
    );

    // When
    try {
      await instance(selector).next({
        targetID,
        targetPlatform,
        inputText: "",
        inputImageURL: "",
        inputCoordinate: DEFAULT_COORDINATES,
        stickerID: "",
      });

      // Then
      throw new Error("Never should have come here");
    } catch {}
  });
});
