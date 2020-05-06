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
import {
  FacebookMessageProcessor,
  FacebookRequestInput,
} from "../type/facebook";
import { LeafSelector } from "../type/leaf";
import { AmbiguousPlatform } from "../type/messenger";
import { AmbiguousRequest } from "../type/request";
import { AmbiguousResponse } from "../type/response";
import { TelegramMessageProcessor } from "../type/telegram";
import {
  createCrossPlatformMessenger,
  createMessageProcessor,
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
      output: [],
    });

    // Then
    expectJs(nextResult).to.eql(NextResult.FAILURE);
    expectJs(complete).to.be.ok();
    verify(messageProcessor.sendResponse(anything())).never();
  });

  it("Should process input when receiving request", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(leafSelector.next(anything())).thenResolve();
    const oldContext = { a: 1, b: 2 };

    const input: readonly FacebookRequestInput[] = [
      {
        targetPlatform,
        inputText: "text-1",
        inputImageURL: "image-1",
        inputCoordinate: { lat: 0, lng: 0 },
        stickerID: "",
      },
      {
        targetPlatform,
        inputText: "text-2",
        inputImageURL: "image-2",
        inputCoordinate: { lat: 1, lng: 1 },
        stickerID: "",
      },
    ];

    // When
    const messageProcessor = await createMessageProcessor({
      targetPlatform,
      leafSelector: instance(leafSelector),
      client: instance(client),
      mapRequest: async () => [] as readonly AmbiguousRequest<{}>[],
      mapResponse: async () => [],
    });

    await messageProcessor.receiveRequest({
      targetID,
      targetPlatform,
      oldContext,
      input,
    });

    // Then
    input.forEach((input) =>
      verify(
        leafSelector.next(
          deepEqual({ input, oldContext, targetID, targetPlatform })
        )
      ).once()
    );
  });
});

describe("Cross platform messenger", () => {
  let fbProcessor: FacebookMessageProcessor<{}>;
  let tlProcessor: TelegramMessageProcessor<{}>;
  let processors: Parameters<typeof createCrossPlatformMessenger>[0];
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
        targetPlatform: "facebook",
        oldContext: {},
        input: [],
      },
    ]);

    when(tlProcessor.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        currentBot: { id: 0, first_name: "", username: "" },
        input: [],
        oldContext: {},
        targetPlatform: "telegram" as const,
        telegramUser: {
          id: 0,
          first_name: "",
          last_name: "",
          username: "",
          language_code: "en" as const,
          is_bot: false,
        },
      },
    ]);

    const platforms = Object.keys(processors) as readonly AmbiguousPlatform[];

    // When
    for (const targetPlatform of platforms) {
      const crossMessenger = createCrossPlatformMessenger(
        processorInstances,
        () => targetPlatform
      );

      await crossMessenger.processRawRequest({});

      // Then
      verify(processors[targetPlatform]!.generalizeRequest(anything())).once();
      verify(processors[targetPlatform]!.receiveRequest(anything())).once();
    }
  });

  it("Should throw error if platform is not available", async () => {
    // Setup
    const platformMessenger = await createCrossPlatformMessenger({});

    // When && Then: Facebook
    try {
      await platformMessenger.processRawRequest({ object: "", entry: {} });
      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await platformMessenger.processRawRequest({ update_id: "" });
      throw new Error("Never should have come here");
    } catch (e) {}
  });
});
