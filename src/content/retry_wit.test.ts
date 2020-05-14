import expectJs from "expect.js";
import { beforeEach, describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../stream";
import { AmbiguousLeaf } from "../type/leaf";
import { WitClient, WitResponse } from "../type/wit";
import { retryWithWit } from "./retry_wit";

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

  it("Should return original request result if invalid input type", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.FALLTHROUGH);
    const transformer = await retryWithWit(instance(comm));
    const transformed = await transformer(instance(rootLeaf));

    // When
    const result = await transformed.next({
      targetID,
      targetPlatform,
      changedContext: {},
      currentContext: {},
      currentLeafName: "",
      input: { type: "placebo" },
      newContext: {},
      oldContext: {},
      type: "context_trigger",
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
      input: { inputText: "some-text", type: "text" },
      type: "message_trigger",
    });

    // Then
    verify(comm.validate(anything())).never();
  });

  it("Wit engine should intercept fallthroughs from text leaf", async () => {
    // Setup
    const entities: WitResponse["entities"] = {
      a: [{ confidence: 1, value: "some-value", type: "value" }],
    };

    const inputText = "some-text";

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
      _text: inputText,
      msg_id: "",
    });

    const transformed = await retryWithWit(instance(comm))(instance(rootLeaf));

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { inputText, type: "text" },
      type: "message_trigger",
    });

    // Then
    verify(comm.validate(inputText)).once();

    verify(
      rootLeaf.next(
        deepEqual({
          targetID,
          targetPlatform,
          currentContext: {},
          currentLeafName: "",
          input: { entities, intents: [], traits: {}, type: "wit" },
          type: "manual_trigger",
        })
      )
    ).once();
  });
});
