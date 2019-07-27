import { beforeEach, describe, it } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { DEFAULT_COORDINATES } from "../../common/utils";
import { Leaf } from "../../type/leaf";
import { WitCommunicator, WitContext, WitResponse } from "../../type/wit";
import { higherOrderRetryWithWit } from "./wit";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Wit higher order function", () => {
  let comm: WitCommunicator;
  let rootLeaf: Leaf<WitContext>;

  beforeEach(() => {
    comm = spy<WitCommunicator>({ validate: () => Promise.reject("") });

    rootLeaf = spy<Leaf<WitContext>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject("")
    });
  });

  it("Wit engine should not fire if no error", async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve({});
    const transformed = await higherOrderRetryWithWit(instance(comm))(
      instance(rootLeaf)
    );

    // When
    const input = {
      targetID,
      targetPlatform,
      inputText: "some-text",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    };

    await transformed.next(input);

    // Then
    verify(comm.validate(anything())).never();
  });

  it("Wit engine should intercept errors", async () => {
    // Setup
    const witEntities: WitResponse["entities"] = {
      a: [{ confidence: 1, value: "some-value", type: "value" }]
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
      msg_id: ""
    });

    const transformed = await higherOrderRetryWithWit(instance(comm))(
      instance(rootLeaf)
    );

    // When
    const input = {
      targetID,
      targetPlatform,
      inputText,
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    };

    await transformed.next(input);

    // Then
    verify(comm.validate(inputText)).once();
    verify(rootLeaf.next(deepEqual({ ...input, witEntities }))).once();
  });
});
