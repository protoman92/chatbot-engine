import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../stream";
import {
  AmbiguousLeaf,
  FacebookRawRequest,
  WitClient,
  WitResponse,
} from "../type";
import { getHighestConfidence, retryWithWit } from "./retry_wit";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Wit higher order function", () => {
  let comm: WitClient;
  let rootLeaf: AmbiguousLeaf;

  beforeEach(() => {
    comm = spy<WitClient>({
      validate: () => {
        return Promise.reject("");
      },
    });

    rootLeaf = spy<AmbiguousLeaf>({
      next: () => {
        return Promise.reject("");
      },
      subscribe: () => {
        return Promise.reject("");
      },
    });
  });

  it("Getting highest confidence should work", async () => {
    expect(
      getHighestConfidence({
        intents: [{ confidence: 0.1, id: "0", name: "intent1" }],
        traits: {
          trait1: [{ confidence: 0.2, value: "true", type: "value" }],
          trait2: [{ confidence: 0.3, value: "true", type: "value" }],
        },
      })
    ).toEqual({
      confidence: 0.3,
      value: "true",
      trait: "trait2",
      type: "value",
      witType: "trait",
    });

    expect(
      getHighestConfidence({
        intents: [{ confidence: 0.3, id: "0", name: "intent1" }],
        traits: {
          trait1: [{ confidence: 0.2, value: "true", type: "value" }],
          trait2: [{ confidence: 0.1, value: "true", type: "value" }],
        },
      })
    ).toEqual({ confidence: 0.3, id: "0", name: "intent1", witType: "intent" });
  });

  it("Should return original request result if invalid input type", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.FALLTHROUGH);
    const transformer = await retryWithWit(instance(comm));
    const transformed = await transformer(instance(rootLeaf));

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: {
        changedContext: {},
        newContext: {},
        oldContext: {},
        type: "context_change",
      },
      triggerType: "manual",
    });

    // Then
    expect(result).toEqual(NextResult.FALLTHROUGH);
  });

  it("Wit engine should not fire if no fallthrough from root leaf", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.BREAK);
    const transformed = await retryWithWit(instance(comm))(instance(rootLeaf));

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "some-text", type: "text" },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message",
    });

    // Then
    verify(comm.validate(anything())).never();
  });

  it("Wit engine should intercept fallthrough from text leaf", async () => {
    // Setup
    const entities: WitResponse["entities"] = {
      a: [
        {
          body: "some-body",
          confidence: 1,
          value: "some-value",
          type: "value",
        },
      ],
    };

    const text = "some-text";

    when(rootLeaf.next(anything())).thenCall(async ({ witEntities = {} }) => {
      if (Object.entries(witEntities).length === 0) {
        return NextResult.FALLTHROUGH;
      }

      return NextResult.BREAK;
    });
    when(comm.validate(anything())).thenResolve({
      entities,
      intents: [],
      traits: {},
      _text: text,
      msg_id: "",
    });

    const transformed = await retryWithWit(instance(comm))(instance(rootLeaf));

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text, type: "text" },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message",
    });

    // Then
    verify(comm.validate(text)).once();
    verify(
      rootLeaf.next(
        deepEqual({
          targetID,
          targetPlatform,
          currentContext: {},
          currentLeafName: "",
          input: {
            entities,
            highestConfidence: undefined,
            intents: [],
            traits: {},
            type: "wit",
          },
          triggerType: "manual",
        })
      )
    ).once();
  });
});
