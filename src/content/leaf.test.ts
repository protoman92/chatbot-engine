import expectJs from "expect.js";
import { describe, it } from "mocha";
import { Omit } from "ts-essentials";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { DEFAULT_COORDINATES, isType } from "../common/utils";
import { bridgeEmission } from "../stream";
import { Facebook } from "../type/facebook";
import { Leaf } from "../type/leaf";
import { Telegram } from "../type/telegram";
import { VisualContent } from "../type/visual-content";
import {
  createDefaultErrorLeaf,
  createLeafObserverForPlatforms,
  createLeafWithObserver,
  createObserverChain
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

    if (isType<VisualContent.MainContent.Text>(response, "text")) {
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

describe("Leaf observer chain", () => {
  it("Observer chain should work", async () => {
    // Setup
    let nextCount = 0;

    const observer = await createObserverChain()
      .orNext(async () => {
        nextCount += 1;
        return undefined;
      })
      .andNext(async () => {
        nextCount += 1;
        return {};
      })
      .orNext(async () => {
        nextCount += 1;
        return undefined;
      })
      .andNext(async () => {
        nextCount += 1;
        return {};
      })
      .toObserver();

    // When
    const result = await observer.next({
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    });

    // Then
    expectJs(nextCount).to.eql(4);
    expectJs(result).to.eql({});
  });

  it("Observer chain should terminate early with invalid and", async () => {
    // Setup
    let nextCount = 0;

    const observer = await createObserverChain()
      .andNext(async () => {
        nextCount += 1;
        return {};
      })
      .andNext(async () => {
        nextCount += 1;
        return undefined;
      })
      .andNext(async () => {
        nextCount += 1;
        return {};
      })
      .andNext(async () => {
        nextCount += 1;
        return {};
      })
      .toObserver();

    // When
    const result = await observer.next({
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    });

    // Then
    expectJs(nextCount).to.eql(2);
    expectJs(result).to.not.be.ok();
  });

  it("Observer chain should terminate early with valid or", async () => {
    // Setup
    let nextCount = 0;

    const observer = await createObserverChain()
      .andNext(async () => {
        nextCount += 1;
        return {};
      })
      .orNext(async () => {
        nextCount += 1;
        return {};
      })
      .orNext(async () => {
        nextCount += 1;
        return undefined;
      })
      .orNext(async () => {
        nextCount += 1;
        return undefined;
      })
      .toObserver();

    // When
    const result = await observer.next({
      targetID,
      targetPlatform,
      inputText: "",
      inputImageURL: "",
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ""
    });

    // Then
    expectJs(nextCount).to.eql(2);
    expectJs(result).to.be.ok();
  });
});