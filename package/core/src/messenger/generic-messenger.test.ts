import {
  anything,
  capture,
  deepEqual,
  instance,
  spy,
  verify,
  when,
} from "ts-mockito";
import { createSubscription } from "..";
import {
  AmbiguousGenericRequest,
  AmbiguousGenericResponse,
  AmbiguousPlatform,
  BaseMessageProcessor,
  FacebookMessageProcessor,
  FacebookRawRequest,
  LeafSelector,
  PlatformClientResponseSender,
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
  let client: PlatformClientResponseSender<unknown, unknown>;

  beforeEach(async () => {
    leafSelector = spy<LeafSelector>({
      next: () => Promise.reject(""),
      subscribe: () => Promise.reject(""),
    });

    client = spy<typeof client>({
      sendResponse: () => Promise.reject(""),
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
        originalRequest: {} as AmbiguousGenericRequest,
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
        originalRequest: {} as AmbiguousGenericRequest,
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
        triggerType: "message",
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
          triggerType: "message",
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
      generalizeRequest: async () => {
        return [];
      },
      receiveRequest: async () => {
        return undefined;
      },
      sendResponse: async () => {
        return {};
      },
    });

    tlProcessor = spy<TelegramMessageProcessor>({
      generalizeRequest: async () => {
        return [];
      },
      receiveRequest: async () => {
        return undefined;
      },
      sendResponse: async () => {
        return [];
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
        triggerType: "message",
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
        triggerType: "message",
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

      await messenger.next({ rawRequest: {} });

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
      await messenger.next({
        rawRequest: { object: "", entry: {} },
      });

      throw new Error("Never should have come here");
    } catch (e) {}

    // When && Then: Telegram
    try {
      await messenger.next({ rawRequest: { update_id: "" } });
      throw new Error("Never should have come here");
    } catch (e) {}
  });
});

describe("Generic messenger", () => {
  let leafSelector: LeafSelector;
  let processor: BaseMessageProcessor;

  beforeEach(() => {
    leafSelector = spy<LeafSelector>({
      next: () => {
        return Promise.reject("");
      },
      subscribe: () => {
        return Promise.reject("");
      },
    });

    processor = spy<BaseMessageProcessor>({
      generalizeRequest: async () => {
        return [];
      },
      receiveRequest: async () => {
        return undefined;
      },
      sendResponse: async () => {
        return {};
      },
    });
  });

  it("Should trigger send with valid response", async () => {
    // Setup
    const subscription = createSubscription(() => {});
    when(leafSelector.subscribe(anything())).thenResolve(subscription);
    when(processor.sendResponse(anything())).thenResolve();

    // When
    const messenger = await createMessenger({
      leafSelector: instance(leafSelector),
      processor: instance(processor),
    });

    const messengerSubscription = await messenger.subscribe({ next: () => {} });

    const { next } = capture(leafSelector.subscribe).first()[0];

    const genericResponse: AmbiguousGenericResponse = {
      targetID,
      targetPlatform,
      originalRequest: {
        targetID,
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        triggerType: "message",
      },
      output: [],
    };

    await next(genericResponse);

    // Then
    messengerSubscription.unsubscribe();
    verify(processor.sendResponse(deepEqual({ genericResponse }))).once();
  });
});
