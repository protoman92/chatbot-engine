import { isType } from "@haipham/javascript-helper-preconditions";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { bridgeEmission, NextResult } from "../stream";
import {
  AmbiguousLeaf,
  ErrorLeafConfig,
  FacebookLeaf,
  FacebookRawRequest,
  TelegramLeaf,
  TelegramRawRequest,
  _FacebookGenericResponseOutput,
} from "../type";
import { createDefaultErrorLeaf, createLeaf, createLeafObserver } from "./leaf";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Create leaf with observer", () => {
  it("Should add originalRequest to response", async () => {
    // Setup
    const leaf = await createLeaf((observer) => ({
      next: async ({ targetID }) => {
        await observer.next({
          targetID,
          output: [],
          targetPlatform: "facebook",
        });

        return NextResult.BREAK;
      },
    }));

    const genericRequest = {
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" as const },
      rawRequest: {} as FacebookRawRequest,
      type: "message_trigger" as const,
    };

    // When
    const { originalRequest } = await bridgeEmission(leaf)(genericRequest);

    // Then
    expect(originalRequest).toEqual(genericRequest);
  });

  it("Should add currentLeafName to error if error encountered", async () => {
    // Setup
    const currentLeafName = "current_leaf_name";
    const error = new Error("some_error");

    const leaf = await createLeaf(() => ({
      next: async () => {
        throw error;
      },
    }));

    try {
      // When
      await leaf.next({
        currentLeafName,
        targetID,
        targetPlatform,
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        type: "message_trigger",
      });
    } catch (e) {
      // Then
      expect(e).toHaveProperty("currentLeafName", currentLeafName);
    }
  });
});

describe("Default error leaf", () => {
  it("Should work correctly", async () => {
    // Setup
    const errorConfig: ErrorLeafConfig = spy({
      formatErrorMessage: ({ message }) => message,
      trackError: () => {},
    });

    const errorLeafName = "error_leaf";
    const error = new Error("some-error");
    const errorLeaf = await createDefaultErrorLeaf(instance(errorConfig));

    // When
    const { output } = await bridgeEmission(errorLeaf)({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: errorLeafName,
      input: { error, erroredLeaf: errorLeafName, type: "error" },
      type: "manual_trigger",
    });

    // Then
    verify(errorConfig.formatErrorMessage(error)).once();
    verify(
      errorConfig.trackError!(
        deepEqual({
          error,
          targetID,
          targetPlatform,
          erroredLeaf: errorLeafName,
        })
      )
    ).once();

    expect(output).toHaveLength(1);
    const [{ content: response }] = output;

    if (isType<_FacebookGenericResponseOutput.Content.Text>(response, "text")) {
      expect(response.text).toContain(error.message);
    } else {
      throw new Error("Never should have come here");
    }
  });
});

describe("Leaf for platforms", () => {
  let fbLeaf: Omit<FacebookLeaf, "subscribe">;
  let tlLeaf: Omit<TelegramLeaf, "subscribe">;
  let platformLeaf: AmbiguousLeaf;

  beforeEach(async () => {
    fbLeaf = spy<Omit<FacebookLeaf, "subscribe">>({
      next: () => Promise.reject(""),
      complete: () => Promise.reject(""),
    });

    tlLeaf = spy<Omit<TelegramLeaf, "subscribe">>({
      next: () => Promise.reject(""),
      complete: () => Promise.reject(""),
    });

    platformLeaf = await createLeaf(() => {
      return createLeafObserver({
        facebook: instance(fbLeaf),
        telegram: instance(tlLeaf),
      });
    });
  });

  it("Should work for different platforms", async () => {
    // Setup
    when(fbLeaf.next(anything())).thenResolve(NextResult.BREAK);
    when(fbLeaf.complete!()).thenResolve({});
    when(tlLeaf.next(anything())).thenResolve(NextResult.BREAK);
    when(tlLeaf.complete!()).thenResolve({});

    // When
    await platformLeaf.next({
      targetID,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" },
      rawRequest: {} as FacebookRawRequest,
      targetPlatform: "facebook",
      type: "message_trigger",
    });

    await platformLeaf.next({
      targetID,
      currentBot: {
        id: 1,
        first_name: "",
        username: "",
      },
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" },
      rawRequest: {} as TelegramRawRequest,
      targetPlatform: "telegram",
      telegramUser: {
        id: 1,
        first_name: "",
        last_name: "",
        language_code: "en",
        is_bot: false,
        username: "",
      },
      type: "message_trigger",
    });

    await platformLeaf.complete!();
    await platformLeaf.subscribe({ next: async () => NextResult.BREAK });

    // Then
    verify(fbLeaf.next(anything())).once();
    verify(fbLeaf.complete!()).once();
    verify(tlLeaf.next(anything())).once();
    verify(tlLeaf.complete!()).once();
  });

  it("Should throw error if platform is not available", async () => {
    // Setup
    const platformObserver = await createLeafObserver({});

    // When && Then: Facebook
    try {
      await platformObserver.next({
        targetID,
        currentContext: {},
        currentLeafName: "",
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        type: "message_trigger",
      });

      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await platformObserver.next({
        targetID,
        currentBot: {
          id: 1,
          first_name: "",
          username: "",
        },
        currentContext: {},
        currentLeafName: "",
        input: { text: "", type: "text" },
        rawRequest: {} as TelegramRawRequest,
        targetPlatform: "telegram",
        telegramUser: {
          id: 1,
          first_name: "",
          last_name: "",
          language_code: "en",
          is_bot: false,
          username: "",
        },
        type: "message_trigger",
      });

      throw new Error("Never should have come here");
    } catch (e) {}
  });
});
