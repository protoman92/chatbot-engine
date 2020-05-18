import expectJs from "expect.js";
import { beforeEach, describe } from "mocha";
import {
  anything,
  capture,
  deepEqual,
  instance,
  spy,
  verify,
  when,
} from "ts-mockito";
import { NextResult } from "../stream";
import { PlatformClient } from "../type/client";
import { FacebookMessageProcessor } from "../type/facebook";
import { LeafSelector } from "../type/leaf";
import { AmbiguousPlatform } from "../type/messenger";
import { AmbiguousRequest } from "../type/request";
import { AmbiguousResponse } from "../type/response";
import { TelegramMessageProcessor } from "../type/telegram";
import {
  createCrossPlatformMessageProcessor,
  createMessageProcessor,
  createMessenger,
} from "./generic-messenger";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Generic message processor", () => {
  let leafSelector: LeafSelector<{}>;
  let client: PlatformClient<unknown>;

  beforeEach(async () => {
    leafSelector = spy<LeafSelector<{}>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });

    client = spy<PlatformClient<unknown>>({
      sendResponse: () => Promise.reject(""),
      setTypingIndicator: () => Promise.reject(""),
    });
  });

  it("Should trigger send with valid response", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(client.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

    // When
    const messageProcessor = spy(
      await createMessageProcessor({
        targetPlatform,
        leafSelector: instance(leafSelector),
        client: instance(client),
        mapRequest: async () => [],
        mapResponse: async () => platformResponses,
      })
    );

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const response: AmbiguousResponse<{}> = {
      targetID,
      targetPlatform,
      originalRequest: {
        targetID,
        currentContext: {},
        input: { text: "", type: "text" },
        targetPlatform: "facebook",
        type: "message_trigger",
      },
      output: [],
    };

    await next(response);

    // Then
    expectJs(complete).to.be.ok();
    verify(messageProcessor.sendResponse(deepEqual(response))).once();

    platformResponses.forEach((response) => {
      verify(client.sendResponse(deepEqual(response))).once();
    });
  });

  it("Should not trigger send without matching target platform", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(client.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

    // When
    const messageProcessor = spy(
      await createMessageProcessor({
        targetPlatform: "telegram",
        leafSelector: instance(leafSelector),
        client: instance(client),
        mapRequest: async () => [],
        mapResponse: async () => platformResponses,
      })
    );

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const nextResult = await next({
      targetID,
      targetPlatform,
      originalRequest: {
        targetID,
        currentContext: {},
        input: { text: "", type: "text" },
        targetPlatform: "facebook",
        type: "message_trigger",
      },
      output: [],
    });

    // Then
    expectJs(nextResult).to.eql(NextResult.FALLTHROUGH);
    expectJs(complete).to.be.ok();
    verify(messageProcessor.sendResponse(anything())).never();
  });

  it("Should send input to leaf selector when receiving request", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(leafSelector.next(anything())).thenResolve();
    const currentContext = { a: 1, b: 2 };

    // When
    const messageProcessor = await createMessageProcessor({
      targetPlatform,
      leafSelector: instance(leafSelector),
      client: instance(client),
      mapRequest: async () => [] as readonly AmbiguousRequest<{}>[],
      mapResponse: async () => [],
    });

    await messageProcessor.receiveRequest({
      currentContext,
      targetID,
      targetPlatform,
      input: { text: "", type: "text" },
      type: "message_trigger",
    });

    // Then
    verify(
      leafSelector.next(
        deepEqual({
          currentContext,
          targetID,
          targetPlatform,
          input: { text: "", type: "text" },
          type: "message_trigger",
        })
      )
    ).once();
  });
});

describe("Cross platform message processor", () => {
  let fbProcessor: FacebookMessageProcessor<{}>;
  let tlProcessor: TelegramMessageProcessor<{}>;
  let processors: Parameters<typeof createCrossPlatformMessageProcessor>[0];
  let processorInstances: typeof processors;

  beforeEach(() => {
    fbProcessor = spy<FacebookMessageProcessor<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({}),
    });

    tlProcessor = spy<TelegramMessageProcessor<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({}),
    });

    processors = { facebook: fbProcessor, telegram: tlProcessor };

    processorInstances = Object.entries(processors)
      .map(([key, value]) => ({
        [key]: instance(value),
      }))
      .reduce((acc, item) => ({ ...acc, ...item })) as typeof processors;
  });

  it("Should invoke correct message processor", async () => {
    // Setup
    when(fbProcessor.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        currentContext: {},
        input: { text: "", type: "text" },
        targetPlatform: "facebook",
        type: "message_trigger",
      },
    ]);

    when(tlProcessor.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        currentBot: { id: 0, first_name: "", username: "" },
        currentContext: {},
        input: { text: "", type: "text" },
        targetPlatform: "telegram" as const,
        telegramUser: {
          id: 0,
          first_name: "",
          last_name: "",
          username: "",
          language_code: "en" as const,
          is_bot: false,
        },
        type: "message_trigger",
      },
    ]);

    const platforms = Object.keys(processors) as readonly AmbiguousPlatform[];

    // When
    for (const targetPlatform of platforms) {
      const crossProcessor = createCrossPlatformMessageProcessor(
        processorInstances,
        () => targetPlatform
      );

      const messenger = createMessenger(crossProcessor);
      await messenger.processRawRequest({});

      // Then
      verify(processors[targetPlatform]!.generalizeRequest(anything())).once();
      verify(processors[targetPlatform]!.receiveRequest(anything())).once();
    }
  });

  it("Should throw error if platform is not available", async () => {
    // Setup
    const crossProcessor = createCrossPlatformMessageProcessor({});
    const messenger = await createMessenger(crossProcessor);

    // When && Then: Facebook
    try {
      await messenger.processRawRequest({ object: "", entry: {} });
      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await messenger.processRawRequest({ update_id: "" });
      throw new Error("Never should have come here");
    } catch (e) {}
  });
});
