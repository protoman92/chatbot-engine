import {
  anything,
  capture,
  deepEqual,
  instance,
  spy,
  verify,
  when,
} from "ts-mockito";
import {
  AmbiguousGenericRequest,
  AmbiguousGenericResponse,
  AmbiguousPlatform,
  BaseMessageProcessor,
  FacebookMessageProcessor,
  FacebookRawRequest,
  LeafSelector,
  PlatformClient,
  TelegramMessageProcessor,
  TelegramRawRequest,
} from "../type";
import {
  createCrossPlatformMessageProcessor,
  createMessageProcessor,
  createMessenger,
} from "./generic-messenger";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Generic message processor", () => {
  let leafSelector: LeafSelector;
  let client: PlatformClient<unknown>;

  beforeEach(async () => {
    leafSelector = spy<LeafSelector>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });

    client = spy<PlatformClient<unknown>>({
      sendResponse: () => Promise.reject(""),
      setTypingIndicator: () => Promise.reject(""),
    });
  });

  it("Should trigger send with matching target platform", async () => {
    // Setup
    when(client.sendResponse(anything())).thenResolve();
    const rawResponses = [{ a: 1 }, { b: 2 }];

    // When
    const messageProcessor = spy(
      await createMessageProcessor({
        targetPlatform,
        leafSelector: instance(leafSelector),
        client: instance(client),
        mapRequest: async () => [],
        mapResponse: async () => rawResponses,
      })
    );

    await messageProcessor.sendResponse({
      genericResponse: {
        targetID,
        targetPlatform,
        output: [{ content: { text: "", type: "text" } }],
      },
    });

    // Then
    rawResponses.forEach((r) => client.sendResponse(deepEqual(r)));
  });

  it("Should not trigger send without matching target platform", async () => {
    // Setup
    when(client.sendResponse(anything())).thenResolve();

    // When
    const messageProcessor = spy(
      await createMessageProcessor({
        targetPlatform: "telegram",
        leafSelector: instance(leafSelector),
        client: instance(client),
        mapRequest: async () => [],
        mapResponse: async () => [{ a: 1 }, { b: 2 }],
      })
    );

    await messageProcessor.sendResponse({
      genericResponse: {
        targetID,
        targetPlatform,
        output: [{ content: { text: "", type: "text" } }],
      },
    });

    // Then
    verify(client.sendResponse(anything())).never();
  });

  it("Should send input to leaf selector when receiving request", async () => {
    // Setup
    when(leafSelector.next(anything())).thenResolve();
    const currentContext = { a: 1, b: 2 };

    // When
    const messageProcessor = await createMessageProcessor({
      targetPlatform,
      leafSelector: instance(leafSelector),
      client: instance(client),
      mapRequest: async () => [] as readonly AmbiguousGenericRequest[],
      mapResponse: async () => [],
    });

    await messageProcessor.receiveRequest({
      genericRequest: {
        currentContext,
        targetID,
        targetPlatform,
        rawRequest: {} as FacebookRawRequest,
        input: { type: "placebo" },
        type: "message_trigger",
      },
    });

    // Then
    verify(
      leafSelector.next(
        deepEqual({
          currentContext,
          targetID,
          targetPlatform,
          rawRequest: {} as FacebookRawRequest,
          input: { type: "placebo" },
          type: "message_trigger",
        })
      )
    ).once();
  });
});

describe("Cross platform message processor", () => {
  let leafSelector: LeafSelector;
  let fbProcessor: FacebookMessageProcessor;
  let tlProcessor: TelegramMessageProcessor;
  let processors: Parameters<typeof createCrossPlatformMessageProcessor>[0];
  let processorInstances: typeof processors;

  beforeEach(() => {
    leafSelector = spy<LeafSelector>({
      next: () => {
        return Promise.reject("");
      },
      subscribe: () => {
        return Promise.reject("");
      },
    });

    fbProcessor = spy<FacebookMessageProcessor>({
      generalizeRequest: () => {
        return Promise.resolve([]);
      },
      receiveRequest: () => {
        return Promise.resolve(undefined);
      },
      sendResponse: () => {
        return Promise.resolve({});
      },
    });

    tlProcessor = spy<TelegramMessageProcessor>({
      generalizeRequest: () => {
        return Promise.resolve([]);
      },
      receiveRequest: () => {
        return Promise.resolve(undefined);
      },
      sendResponse: () => {
        return Promise.resolve([]);
      },
    });

    processors = { facebook: fbProcessor, telegram: tlProcessor };

    processorInstances = Object.entries(processors)
      .map(([key, value]) => ({ [key]: instance(value) }))
      .reduce((acc, item) => ({ ...acc, ...item })) as typeof processors;
  });

  it("Should invoke correct message processor", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();

    when(fbProcessor.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        type: "message_trigger",
      },
    ]);

    when(tlProcessor.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        chatType: "private",
        currentBot: { id: 0, first_name: "", username: "" },
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as TelegramRawRequest,
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
      const processor = createCrossPlatformMessageProcessor(
        processorInstances,
        () => targetPlatform
      );

      const messenger = await createMessenger({
        processor,
        leafSelector: instance(leafSelector),
      });

      await messenger.processRawRequest({ rawRequest: {} });

      // Then
      verify(processors[targetPlatform]!.generalizeRequest(anything())).once();
      verify(processors[targetPlatform]!.receiveRequest(anything())).once();
    }
  });

  it("Should throw error if platform is not available", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    const processor = createCrossPlatformMessageProcessor({});

    const messenger = await createMessenger({
      processor,
      leafSelector: instance(leafSelector),
    });

    // When && Then: Facebook
    try {
      await messenger.processRawRequest({
        rawRequest: { object: "", entry: {} },
      });

      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await messenger.processRawRequest({ rawRequest: { update_id: "" } });
      throw new Error("Never should have come here");
    } catch (e) {}
  });
});

describe("Generic messenger", () => {
  let leafSelector: LeafSelector;
  let processor: BaseMessageProcessor;

  beforeEach(() => {
    leafSelector = spy<LeafSelector>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });

    processor = spy<BaseMessageProcessor>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve(undefined),
      sendResponse: () => Promise.resolve({}),
    });
  });

  it("Should trigger send with valid response", async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(processor.sendResponse(anything())).thenResolve();

    // When
    await createMessenger({
      leafSelector: instance(leafSelector),
      processor: instance(processor),
    });

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const genericResponse: AmbiguousGenericResponse = {
      targetID,
      targetPlatform,
      originalRequest: {
        targetID,
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        type: "message_trigger",
      },
      output: [],
    };

    await next(genericResponse);

    // Then
    expect(complete).toBeTruthy();
    verify(processor.sendResponse(deepEqual({ genericResponse }))).once();
  });
});
