import expectJs from "expect.js";
import { beforeEach, describe } from "mocha";
import {
  anything,
  capture,
  deepEqual,
  instance,
  spy,
  verify,
  when
} from "ts-mockito";
import { PlatformCommunicator } from "../type/communicator";
import {
  FacebookMessageProcessor,
  GenericFacebookRequestInput
} from "../type/facebook";
import { Leaf } from "../type/leaf";
import { SupportedPlatform } from "../type/messenger";
import { GenericRequest } from "../type/request";
import { GenericResponse } from "../type/response";
import { TelegramMessageProcessor } from "../type/telegram";
import {
  createCrossPlatformMessenger,
  createMessageProcessor
} from "./generic-messenger";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Generic message processor", () => {
  let leafSelector: Leaf<{}>;
  let communicator: PlatformCommunicator<unknown>;

  beforeEach(async () => {
    leafSelector = spy<Leaf<{}>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject("")
    });

    communicator = spy<PlatformCommunicator<unknown>>({
      sendResponse: () => Promise.reject(""),
      setTypingIndicator: () => Promise.reject("")
    });
  });

  it("Should trigger send with valid response", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(communicator.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

    // When
    const messageProcessor = spy(
      await createMessageProcessor({
        targetPlatform,
        leafSelector: instance(leafSelector),
        communicator: instance(communicator),
        mapRequest: async () => [],
        mapResponse: async () => platformResponses
      })
    );

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const response: GenericResponse<{}> = {
      targetID,
      targetPlatform,
      output: []
    };

    await next(response);

    // Then
    expectJs(complete).to.be.ok();
    verify(messageProcessor.sendResponse(deepEqual(response))).once();

    platformResponses.forEach(response => {
      verify(communicator.sendResponse(deepEqual(response))).once();
    });
  });

  it("Should not trigger send without matching target platform", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(communicator.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

    // When
    const messageProcessor = spy(
      await createMessageProcessor({
        targetPlatform: "telegram",
        leafSelector: instance(leafSelector),
        communicator: instance(communicator),
        mapRequest: async () => [],
        mapResponse: async () => platformResponses
      })
    );

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const nextResult = await next({
      targetID,
      targetPlatform,
      output: []
    });

    // Then
    expectJs(nextResult).to.eql(undefined);
    expectJs(complete).to.be.ok();
    verify(messageProcessor.sendResponse(anything())).never();
  });

  it("Should process input when receiving request", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(leafSelector.next(anything())).thenResolve();
    const oldContext = { a: 1, b: 2 };

    const input: readonly GenericFacebookRequestInput[] = [
      {
        targetPlatform,
        inputText: "text-1",
        inputImageURL: "image-1",
        inputCoordinate: { lat: 0, lng: 0 },
        stickerID: ""
      },
      {
        targetPlatform,
        inputText: "text-2",
        inputImageURL: "image-2",
        inputCoordinate: { lat: 1, lng: 1 },
        stickerID: ""
      }
    ];

    // When
    const messageProcessor = await createMessageProcessor({
      targetPlatform,
      leafSelector: instance(leafSelector),
      communicator: instance(communicator),
      mapRequest: async () => [] as readonly GenericRequest<{}>[],
      mapResponse: async () => []
    });

    await messageProcessor.receiveRequest({
      targetID,
      targetPlatform,
      oldContext,
      input
    });

    // Then
    input.forEach(datum =>
      verify(
        leafSelector.next(
          deepEqual({ ...datum, ...oldContext, targetID, targetPlatform })
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
      sendResponse: () => Promise.resolve({})
    });

    tlProcessor = spy<TelegramMessageProcessor<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({})
    });

    processors = { facebook: fbProcessor, telegram: tlProcessor };

    processorInstances = Object.entries(processors)
      .map(([key, value]) => ({
        [key]: instance(value)
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
        input: []
      }
    ]);

    when(tlProcessor.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        targetPlatform: "telegram" as const,
        oldContext: {},
        input: [],
        telegramUser: {
          id: 0,
          first_name: "",
          last_name: "",
          username: "",
          language_code: "en" as const,
          is_bot: false
        }
      }
    ]);

    const platforms = Object.keys(processors) as readonly SupportedPlatform[];

    // When
    for (const targetPlatform of platforms) {
      const crossMessenger = createCrossPlatformMessenger(
        processorInstances,
        () => targetPlatform
      );

      await crossMessenger.processPlatformRequest({});

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
      await platformMessenger.processPlatformRequest({ object: "", entry: {} });
      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await platformMessenger.processPlatformRequest({ update_id: "" });
      throw new Error("Never should have come here");
    } catch (e) {}
  });
});
