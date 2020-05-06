import expectJs from "expect.js";
import { describe, it } from "mocha";
import { Omit } from "ts-essentials";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { isType } from "../common/utils";
import { bridgeEmission, NextResult } from "../stream";
import { FacebookLeaf, FacebookResponseOutput } from "../type/facebook";
import { BaseLeaf } from "../type/leaf";
import { TelegramLeaf } from "../type/telegram";
import {
  createDefaultErrorLeaf,
  createLeafObserverForPlatforms,
  createLeafWithObserver,
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
      stickerID: "",
    });

    // Then
    expectJs(output).to.have.length(1);
    const [{ content: response }] = output;

    if (isType<FacebookResponseOutput.Content.Text>(response, "text")) {
      expectJs(response.text).to.contain(error.message);
    } else {
      throw new Error("Never should have come here");
    }
  });
});

describe("Leaf for platforms", () => {
  let fbLeaf: Omit<FacebookLeaf<{}>, "subscribe">;
  let tlLeaf: Omit<TelegramLeaf<{}>, "subscribe">;
  let platformLeaf: BaseLeaf<{}>;

  beforeEach(async () => {
    fbLeaf = spy<Omit<FacebookLeaf<{}>, "subscribe">>({
      next: () => Promise.reject(""),
      complete: () => Promise.reject(""),
    });

    tlLeaf = spy<Omit<TelegramLeaf<{}>, "subscribe">>({
      next: () => Promise.reject(""),
      complete: () => Promise.reject(""),
    });

    platformLeaf = await createLeafWithObserver<{}>(() => {
      return createLeafObserverForPlatforms({
        facebook: instance(fbLeaf),
        telegram: instance(tlLeaf),
      });
    });
  });

  it("Should work for different platforms", async () => {
    // Setup
    when(fbLeaf.next(anything())).thenResolve(NextResult.SUCCESS);
    when(fbLeaf.complete!()).thenResolve({});
    when(tlLeaf.next(anything())).thenResolve(NextResult.SUCCESS);
    when(tlLeaf.complete!()).thenResolve({});

    // When
    await platformLeaf.next({
      targetID,
      targetPlatform: "facebook",
      inputText: "",
      inputImageURL: "",
      stickerID: "",
    });

    await platformLeaf.next({
      currentBot: {
        id: 1,
        first_name: "Hai",
        username: "test_bot",
      },
      targetID,
      targetPlatform: "telegram",
      inputText: "",
    });

    await platformLeaf.complete!();
    await platformLeaf.subscribe({ next: async () => NextResult.SUCCESS });

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
        inputImageURL: "",
        inputText: "",
        stickerID: "",
      });

      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await platformObserver.next({
        currentBot: {
          id: 1,
          first_name: "Hai",
          username: "test_bot",
        },
        targetID,
        targetPlatform: "telegram",
        inputText: "",
      });

      throw new Error("Never should have come here");
    } catch (e) {}
  });
});
