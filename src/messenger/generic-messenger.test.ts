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
  createCrossPlatformBatchMessenger,
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

describe("Cross platform unit messenger", () => {
  let fbMessenger: FacebookMessageProcessor<{}>;
  let tlMessenger: TelegramMessageProcessor<{}>;
  let messengers: Parameters<typeof createCrossPlatformBatchMessenger>[0];
  let messengerInstances: typeof messengers;

  beforeEach(() => {
    fbMessenger = spy<FacebookMessageProcessor<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({})
    });

    tlMessenger = spy<TelegramMessageProcessor<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({})
    });

    messengers = { facebook: fbMessenger, telegram: tlMessenger };

    messengerInstances = Object.entries(messengers)
      .map(([key, value]) => ({
        [key]: instance(value)
      }))
      .reduce((acc, item) => ({ ...acc, ...item })) as typeof messengers;
  });

  it("Should invoke correct messenger", async () => {
    // Setup
    when(fbMessenger.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        targetPlatform: "facebook",
        oldContext: {},
        input: []
      }
    ]);

    when(tlMessenger.generalizeRequest(anything())).thenResolve([
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

    const platforms = Object.keys(messengers) as readonly SupportedPlatform[];

    // When
    for (const targetPlatform of platforms) {
      const crossMessenger = createCrossPlatformBatchMessenger(
        messengerInstances,
        () => targetPlatform
      );

      await crossMessenger.processPlatformRequest({});

      // Then
      verify(messengers[targetPlatform]!.generalizeRequest(anything())).once();
      verify(messengers[targetPlatform]!.receiveRequest(anything())).once();
    }
  });

  it("Should throw error if platform is not available", async () => {
    // Setup
    const platformMessenger = await createCrossPlatformBatchMessenger({});

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
