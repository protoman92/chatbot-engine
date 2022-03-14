import { anything, instance, spy, verify, when } from "ts-mockito";
import { AmbiguousLeaf, FacebookRawRequest, LeafEnumeration } from "../type";
import { createLeaf, NextResult } from "./leaf";
import { createLeafSelector, enumerateLeaves } from "./leaf-selector";

type TestLeafSelector = ReturnType<
  typeof import("./leaf-selector")["createLeafSelector"]
>;

describe("Leaf enumeration", () => {
  it("Should enumerate leaves correctly", async () => {
    // Setup && When
    const enumerated = await enumerateLeaves({
      branch1: {
        branch12: {
          leaf12: await createLeaf(() => ({
            next: async () => {
              return NextResult.BREAK;
            },
          })),
          branch123: {},
        },
      },
      branch2: {
        branch21: {
          branch213: {},
          branch223: {
            leaf223: createLeaf(() => ({
              next: async () => {
                return NextResult.BREAK;
              },
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
  const targetID = "target-id";
  const targetPlatform = "facebook";
  let currentLeaf: AmbiguousLeaf;
  let selector: TestLeafSelector;

  beforeEach(async () => {
    currentLeaf = spy<AmbiguousLeaf>(
      await createLeaf(() => ({
        checkTextConditions: () => {
          return Promise.reject("");
        },
        checkContextConditions: () => {
          return Promise.reject("");
        },
        next: () => {
          return Promise.reject("");
        },
      }))
    );

    selector = spy<TestLeafSelector>(createLeafSelector({}));
  });

  it("Selecting leaf should stop at first leaf that passes", async () => {
    // Setup
    const iteration = 1000;
    const validLeafID = 500;

    const enumeratedLeaves: LeafEnumeration[] = [
      ...Array(iteration).keys(),
    ].map((i) => ({
      currentLeaf: instance(currentLeaf),
      currentLeafName: `${i}`,
      parentBranch: {},
      prefixLeafPaths: [],
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);
    when(selector.triggerLeaf(anything(), anything())).thenCall(
      async ({ currentLeafName }: LeafEnumeration) => {
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
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message",
    });

    // Then
    verify(selector.triggerLeaf(anything(), anything())).times(validLeafID + 1);
  });

  it("Subscribing to response should merge leaf observables", async () => {
    // Setup
    const enumeratedLeaves: LeafEnumeration[] = [...Array(1000).keys()].map(
      (i) => ({
        currentLeaf: instance(currentLeaf),
        currentLeafName: `${i}`,
        parentBranch: {},
        prefixLeafPaths: [],
      })
    );

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
    when(selector.triggerLeaf(anything(), anything())).thenReturn(
      NextResult.BREAK
    );

    // When
    try {
      await instance(selector).next({
        targetID,
        targetPlatform,
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        triggerType: "message",
      });

      // Then
      throw new Error("Never should have come here");
    } catch {}
  });
});
