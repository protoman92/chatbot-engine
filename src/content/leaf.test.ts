import expectJs from "expect.js";
import { describe, it } from "mocha";
import { Omit } from "ts-essentials";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { DEFAULT_COORDINATES, isType } from "../common/utils";
import { bridgeEmission } from "../stream";
import { Facebook } from "../type/facebook";
import { Leaf } from "../type/leaf";
import { Telegram } from "../type/telegram";
import { RootVisualContent } from "../type/visual-content";
import {
  createDefaultErrorLeaf,
  createLeafObserverForPlatforms,
  createLeafWithObserver
} from "./leaf";

const targetID = "target-id";
const targetPlatform = "facebook";

describe("Default error leaf", () => {
  it("Should work correctly", async () => {
    // Setup
    const errorLeaf = await createDefaultErrorLeaf();
    const error = new Error("some-error");

    // When
    const { output } = await bridgeEmission(errorLeaf)({
      targetID,
      targetPlatform,
      error,
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    });
    // Then
    expectJs(output).to.have.length(1);
    const [{ content: response }] = output;

    if (isType<RootVisualContent.MainContent.Text>(response, "text")) {
      expectJs(response.text).to.contain(error.message);
    } else {
      throw new Error("Never should have come here");
    }
  });
});

describe("Leaf for platforms", () => {
  let fbLeaf: Omit<Facebook.Leaf<{}>, "subscribe">;
  let tlLeaf: Omit<Telegram.Leaf<{}>, "subscribe">;
  let platformLeaf: Leaf<{}>;

  beforeEach(async () => {
    fbLeaf = spy<Omit<Facebook.Leaf<{}>, "subscribe">>({
      next: () => Promise.reject(""),
      complete: () => Promise.reject("")
    });

    tlLeaf = spy<Omit<Telegram.Leaf<{}>, "subscribe">>({
      next: () => Promise.reject(""),
      complete: () => Promise.reject("")
    });

    platformLeaf = await createLeafWithObserver(() => {
      return createLeafObserverForPlatforms({
        facebook: instance(fbLeaf),
        telegram: instance(tlLeaf)
      });
    });
  });

  it("Should work for different platforms", async () => {
    // Setup
    when(fbLeaf.next(anything())).thenResolve({});
    when(fbLeaf.complete!()).thenResolve({});
    when(tlLeaf.next(anything())).thenResolve({});
    when(tlLeaf.complete!()).thenResolve({});

    // When
    await platformLeaf.next({
      targetID,
      targetPlatform: "facebook",
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    });

    await platformLeaf.next({
      targetID,
      targetPlatform: "telegram",
      inputCommand: "",
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      leftChatMembers: [],
      newChatMembers: []
    });

    await platformLeaf.complete!();
    await platformLeaf.subscribe({ next: async () => ({}) });

    // Then
    verify(fbLeaf.next(anything())).once();
    verify(fbLeaf.complete!()).once();
    verify(tlLeaf.next(anything())).once();
    verify(tlLeaf.complete!()).once();
  });

  it("Should throw error if platform is not available", async () => {
    // Setup
    const platformObserver = await createLeafObserverForPlatforms({});

    // When && Then: Facebook
    try {
      await platformObserver.next({
        targetID,
        targetPlatform: "facebook",
        inputCoordinate: DEFAULT_COORDINATES,
        inputImageURL: "",
        inputText: "",
        stickerID: ""
      });

      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await platformObserver.next({
        targetID,
        targetPlatform: "telegram",
        leftChatMembers: [],
        inputCommand: "",
        inputCoordinate: DEFAULT_COORDINATES,
        inputImageURL: "",
        inputText: "",
        newChatMembers: []
      });

      throw new Error("Never should have come here");
    } catch (e) {}
  });
});
