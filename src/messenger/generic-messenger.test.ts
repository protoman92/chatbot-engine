import {
  anything,
  capture,
  deepEqual,
  instance,
  spy,
  verify,
  when,
} from "ts-mockito";
import { _TelegramRawRequest } from "../../build/type";
import {
  AmbiguousGenericRequest,
  AmbiguousGenericResponse,
  AmbiguousPlatform,
  BaseMessageProcessor,
  FacebookMessageProcessor,
  LeafSelector,
  PlatformClient,
  TelegramMessageProcessor,
} from "../type";
import {
  createCrossPlatformMessageProcessor,
  createMessageProcessor,
  createMessenger,
} from "./generic-messenger";

interface Context {}
const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Generic message processor", () => {
  let leafSelector: LeafSelector<Context>;
  let client: PlatformClient<unknown>;

  beforeEach(async () => {
    leafSelector = spy<LeafSelector<Context>>({
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
      targetID,
      targetPlatform,
      output: [{ content: { text: "", type: "text" } }],
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
      targetID,
      targetPlatform,
      output: [{ content: { text: "", type: "text" } }],
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
      mapRequest: async () => [] as readonly AmbiguousGenericRequest<{}>[],
      mapResponse: async () => [],
    });

    await messageProcessor.receiveRequest({
      currentContext,
      targetID,
      targetPlatform,
      input: { type: "placebo" },
      type: "message_trigger",
    });

    // Then
    verify(
      leafSelector.next(
        deepEqual({
          currentContext,
          targetID,
          targetPlatform,
          input: { type: "placebo" },
          type: "message_trigger",
        })
      )
    ).once();
  });
});

describe("Cross platform message processor", () => {
  let leafSelector: LeafSelector<Context>;
  let fbProcessor: FacebookMessageProcessor<Context>;
  let tlProcessor: TelegramMessageProcessor<Context>;
  let processors: Parameters<typeof createCrossPlatformMessageProcessor>[0];
  let processorInstances: typeof processors;

  beforeEach(() => {
    leafSelector = spy<LeafSelector<Context>>({
      next: () => {
        return Promise.reject("");
      },
      subscribe: () => {
        return Promise.reject("");
      },
    });

    fbProcessor = spy<FacebookMessageProcessor<Context>>({
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

    tlProcessor = spy<TelegramMessageProcessor<Context>>({
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
      const processor = createCrossPlatformMessageProcessor(
        processorInstances,
        () => targetPlatform
      );

      const messenger = await createMessenger({
        processor,
        leafSelector: instance(leafSelector),
      });

      await messenger.processRawRequest({});

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

describe("Generic messenger", () => {
  let leafSelector: LeafSelector<Context>;
  let processor: BaseMessageProcessor<Context>;

  beforeEach(() => {
    leafSelector = spy<LeafSelector<Context>>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });

    processor = spy<BaseMessageProcessor<Context>>({
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

    const response: AmbiguousGenericResponse<Context> = {
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
    expect(complete).toBeTruthy();
    verify(processor.sendResponse(deepEqual(response))).once();
  });
});
