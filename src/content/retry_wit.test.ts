import expectJs from "expect.js";
import { beforeEach, describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../stream";
import { AmbiguousLeaf } from "../type/leaf";
import { WitClient, WitResponse } from "../type/wit";
import { getHighestConfidence, retryWithWit } from "./retry_wit";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Wit higher order function", () => {
  interface Context {}
  let comm: WitClient;
  let rootLeaf: AmbiguousLeaf<Context>;

  beforeEach(() => {
    comm = spy<WitClient>({ validate: () => Promise.reject("") });

    rootLeaf = spy<AmbiguousLeaf<Context>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });
  });

  it("Getting highest confidence should work", async () => {
    expectJs(
      getHighestConfidence({
        intents: [{ confidence: 0.1, id: "0", name: "intent1" }],
        traits: {
          trait1: [{ confidence: 0.2, value: "true", type: "value" }],
          trait2: [{ confidence: 0.3, value: "true", type: "value" }],
        },
      })
    ).to.eql({
      confidence: 0.3,
      value: "true",
      trait: "trait2",
      type: "value",
      witType: "trait",
    });

    expectJs(
      getHighestConfidence({
        intents: [{ confidence: 0.3, id: "0", name: "intent1" }],
        traits: {
          trait1: [{ confidence: 0.2, value: "true", type: "value" }],
          trait2: [{ confidence: 0.1, value: "true", type: "value" }],
        },
      })
    ).to.eql({ confidence: 0.3, id: "0", name: "intent1", witType: "intent" });
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
      type: "manual_trigger",
    });

    // Then
    expectJs(result).to.eql(NextResult.FALLTHROUGH);
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
      type: "message_trigger",
    });

    // Then
    verify(comm.validate(anything())).never();
  });

  it("Wit engine should intercept fallthrough from text leaf", async () => {
    // Setup
    const entities: WitResponse["entities"] = {
      a: [{ confidence: 1, value: "some-value", type: "value" }],
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
      type: "message_trigger",
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
          type: "manual_trigger",
        })
      )
    ).once();
  });
});
