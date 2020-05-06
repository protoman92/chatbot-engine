import { beforeEach, describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { NextResult } from "../../stream";
import { AmbiguousLeaf } from "../../type/leaf";
import { WitClient, WitContext, WitResponse } from "../../type/wit";
import { retryWithWit } from "./wit";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Wit higher order function", () => {
  let comm: WitClient;
  let rootLeaf: AmbiguousLeaf<WitContext>;

  beforeEach(() => {
    comm = spy<WitClient>({ validate: () => Promise.reject("") });

    rootLeaf = spy<AmbiguousLeaf<WitContext>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });
  });

  it("Wit engine should not fire if no error", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve(NextResult.SUCCESS);
    const transformed = await retryWithWit(instance(comm))(instance(rootLeaf));

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      input: { inputText: "some-text" },
      oldContext: {},
    });

    // Then
    verify(comm.validate(anything())).never();
  });

  it("Wit engine should intercept errors", async () => {
    // Setup
    const witEntities: WitResponse["entities"] = {
      a: [{ confidence: 1, value: "some-value", type: "value" }],
    };

    const inputText = "some-text";

    when(rootLeaf.next(anything())).thenCall(async ({ witEntities = {} }) => {
      if (Object.entries(witEntities).length === 0) {
        return undefined;
      }

      return {};
    });

    when(comm.validate(anything())).thenResolve({
      entities: witEntities,
      _text: inputText,
      msg_id: "",
    });

    const transformed = await retryWithWit(instance(comm))(instance(rootLeaf));

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      input: { inputText },
      oldContext: {},
    });

    // Then
    verify(comm.validate(inputText)).once();

    verify(
      rootLeaf.next(
        deepEqual({
          targetID,
          targetPlatform,
          input: { inputText },
          oldContext: { witEntities },
        })
      )
    ).once();
  });
});
