import { anything, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../stream";
import { AmbiguousLeaf, LeafEnumeration } from "../type/leaf";
import { createLeafWithObserver } from "./leaf";
import { createLeafSelector, enumerateLeaves } from "./leaf-selector";

type TestLeafSelector = ReturnType<
  typeof import("./leaf-selector")["createLeafSelector"]
>;

describe("Leaf enumeration", () => {
  it("Should enumerate leaves correctly", async () => {
    // Setup && When
    const enumerated = enumerateLeaves({
      branch1: {
        branch12: {
          leaf12: await createLeafWithObserver(async () => ({
            next: async () => NextResult.BREAK,
          })),
          branch123: {},
        },
      },
      branch2: {
        branch21: {
          branch213: {},
          branch223: {
            leaf223: await createLeafWithObserver(async () => ({
              next: async () => NextResult.BREAK,
            })),
          },
        },
      },
    });

    expect(
      enumerated.map(({ currentLeafName, prefixLeafPaths }) => ({
        currentLeafName,
        prefixLeafPaths,
      }))
    ).toEqual([
      {
        currentLeafName: "leaf12",
        prefixLeafPaths: ["branch1", "branch12", "leaf12"],
      },
      {
        currentLeafName: "leaf223",
        prefixLeafPaths: ["branch2", "branch21", "branch223", "leaf223"],
      },
    ]);
  });
});

describe("Leaf selector", () => {
  interface Context {}
  const targetID = "target-id";
  const targetPlatform = "facebook";
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
      currentLeafName: `${i}`,
      parentBranch: {},
      prefixLeafPaths: [],
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    when(selector.triggerLeaf(anything(), anything())).thenCall(
      async ({ currentLeafName }: LeafEnumeration<{}>) => {
        if (currentLeafName === `${validLeafID}`) return NextResult.BREAK;
        return NextResult.FALLTHROUGH;
      }
    );

    // When
    await instance(selector).next({
      targetID,
      targetPlatform,
      currentContext: {},
      input: { text: "", type: "text" },
      type: "message_trigger",
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
      currentLeafName: `${i}`,
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
    expect(completedCount).toEqual(enumeratedLeaves.length);
  });

  it("Subscribing to response should merge leaf observables", async () => {
    // Setup
    const enumeratedLeaves: LeafEnumeration<Context>[] = [
      ...Array(1000).keys(),
    ].map((i) => ({
      currentLeaf: instance(currentLeaf),
      currentLeafName: `${i}`,
      parentBranch: {},
      prefixLeafPaths: [],
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(selector).subscribe({
      next: async () => NextResult.BREAK,
    });

    // Then
    verify(currentLeaf.subscribe(anything())).times(enumeratedLeaves.length);
  });

  it("Subscribing should increase subscribe count", async () => {
    // Setup && When
    await instance(selector).subscribe({
      next: async () => NextResult.BREAK,
    });

    try {
      await instance(selector).subscribe({
        next: async () => NextResult.BREAK,
      });

      fail("Should have failed");
    } catch {}
  });

  it("Should throw error if no enumerated leaves found", async () => {
    // Setup
    when(selector.enumerateLeaves()).thenResolve([]);

    when(selector.triggerLeaf(anything(), anything())).thenResolve(
      NextResult.BREAK
    );

    // When
    try {
      await instance(selector).next({
        targetID,
        targetPlatform,
        currentContext: {},
        input: { text: "", type: "text" },
        type: "message_trigger",
      });

      // Then
      throw new Error("Never should have come here");
    } catch {}
  });
});
