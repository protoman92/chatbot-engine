import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { compose, joinObjects } from "../common/utils";
import {
  AmbiguousRequest,
  AmbiguousResponse,
  BaseMessageProcessor,
  ContextDAO,
  PlatformClient,
  TelegramMessageProcessor,
  _MessageProcessorMiddleware,
} from "../type";
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForTargetID,
  setTypingIndicator,
} from "./messenger-transform";
import { saveTelegramUser } from "./telegram-transform";

type Context = Record<string, unknown>;
const targetPlatform = "facebook";
let msgProcessor: BaseMessageProcessor<Context>;
let client: PlatformClient<unknown>;
let contextDAO: ContextDAO<Context>;
let middlewareInput: _MessageProcessorMiddleware.Input<Context>;

beforeEach(async () => {
  msgProcessor = spy<BaseMessageProcessor<Context>>({
    generalizeRequest: () => Promise.reject(""),
    receiveRequest: () => Promise.reject(""),
    sendResponse: () => Promise.reject(""),
  });

  client = spy<PlatformClient<unknown>>({
    sendResponse: () => Promise.reject(""),
    setTypingIndicator: () => Promise.reject(""),
  });

  contextDAO = spy<ContextDAO<Context>>({
    getContext: () => Promise.reject(""),
    appendContext: () => Promise.reject(""),
    resetContext: () => Promise.reject(""),
  });

  middlewareInput = { getFinalMessageProcessor: () => instance(msgProcessor) };
});

describe("Save context on send", () => {
  const targetID = "target-id";

  it("Should save context on send", async () => {
    // Setup
    const oldContext: {} = { a: 1, b: 2 };
    const additionalContext: {} = { a: 1, b: 2, c: 3 };
    const finalContext = joinObjects(oldContext, additionalContext);

    when(contextDAO.appendContext(anything())).thenResolve({
      oldContext,
      newContext: finalContext,
    });

    when(msgProcessor.sendResponse(anything())).thenResolve();
    when(msgProcessor.receiveRequest(anything())).thenResolve();

    const transformed = await compose(
      instance(msgProcessor),
      saveContextOnSend({ contextDAO: instance(contextDAO) })(middlewareInput)
    );

    const response: AmbiguousResponse<Context> = {
      targetID,
      additionalContext,
      originalRequest: {
        currentContext: {},
        input: { text: "", type: "text" },
        targetID: "some-other-id",
        targetPlatform: "facebook",
        type: "message_trigger",
      },
      output: [],
      targetPlatform: "telegram",
    };

    // When
    await transformed.sendResponse(response);

    // Then
    verify(
      contextDAO.appendContext(
        deepEqual({
          additionalContext,
          targetID,
          oldContext: {},
          targetPlatform: "telegram",
        })
      )
    ).once();

    verify(msgProcessor.sendResponse(deepEqual(response))).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          targetID,
          currentContext: finalContext,
          input: {
            oldContext,
            changedContext: additionalContext,
            newContext: finalContext,
            type: "context_change",
          },
          targetPlatform: "telegram",
          type: "manual_trigger",
        })
      )
    ).once();
  });
});

describe("Inject context on receive", () => {
  const targetID = "target-id";

  it("Should not inject context on receive if invalid request type", async () => {
    // Setup
    when(msgProcessor.receiveRequest(anything())).thenResolve({});

    const transformed = await compose(
      instance(msgProcessor),
      injectContextOnReceive({ contextDAO: instance(contextDAO) })(
        middlewareInput
      )
    );

    // When
    await transformed.receiveRequest({
      targetID,
      targetPlatform,
      currentContext: {},
      input: {
        changedContext: {},
        oldContext: {},
        newContext: {},
        type: "context_change",
      },
      type: "manual_trigger",
    });

    // Then
    verify(contextDAO.getContext(anything())).never();
    verify(msgProcessor.receiveRequest(anything())).once();
  });

  it("Should inject context on receive", async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };
    when(msgProcessor.receiveRequest(anything())).thenResolve({});

    when(
      contextDAO.getContext(deepEqual({ targetID, targetPlatform }))
    ).thenResolve(expectedContext);

    const transformed = await compose(
      instance(msgProcessor),
      injectContextOnReceive({ contextDAO: instance(contextDAO) })(
        middlewareInput
      )
    );

    const genericRequest: AmbiguousRequest<{}> = {
      targetID,
      targetPlatform,
      currentContext: {},
      input: { text: "", type: "text" },
      type: "message_trigger",
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(
      contextDAO.getContext(deepEqual({ targetID, targetPlatform }))
    ).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({ ...genericRequest, currentContext: expectedContext })
      )
    ).once();
  });
});

describe("Save user for target ID", () => {
  const targetID = "target-id";

  it("Should not save user if invalid request type", async () => {
    // Setup
    when(msgProcessor.receiveRequest(anything())).thenResolve({});

    const transformed = await compose(
      instance(msgProcessor),
      saveUserForTargetID({
        contextDAO: instance(contextDAO),
        getUser: async () => ({ id: targetID }),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => ({ additionalContext: { targetID } }),
      })(middlewareInput)
    );

    // When
    await transformed.receiveRequest({
      targetID,
      targetPlatform,
      currentContext: { targetID },
      input: {
        changedContext: {},
        oldContext: {},
        newContext: {},
        type: "context_change",
      },
      type: "manual_trigger",
    });

    // Then
    verify(contextDAO.appendContext(anything())).never();
    verify(msgProcessor.receiveRequest(anything())).once();
  });

  it("Should save user when no user ID is present in context", async () => {
    // Setup
    const additionalContext = { a: 1, b: 2 };

    when(contextDAO.appendContext(anything())).thenResolve({
      newContext: additionalContext,
      oldContext: {},
    });

    when(msgProcessor.receiveRequest(anything())).thenResolve({
      targetID,
      visualContents: [],
    });

    const transformed = await compose(
      instance(msgProcessor),
      saveUserForTargetID({
        contextDAO: instance(contextDAO),
        getUser: async () => ({ id: targetID }),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => ({ additionalContext }),
      })(middlewareInput)
    );

    const genericRequest: AmbiguousRequest<{}> = {
      targetID,
      targetPlatform,
      currentContext: { targetID },
      input: { text: "", type: "text" },
      type: "message_trigger",
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(
      contextDAO.appendContext(
        deepEqual({ additionalContext, targetID, targetPlatform })
      )
    ).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({ ...genericRequest, currentContext: additionalContext })
      )
    ).once();
  });
});

describe("Save Telegram user for target ID", () => {
  const targetID = 1;
  let tlMessenger: TelegramMessageProcessor<{}>;

  beforeEach(() => {
    tlMessenger = spy<TelegramMessageProcessor<{}>>({
      generalizeRequest: () => Promise.reject(""),
      receiveRequest: () => Promise.reject(""),
      sendResponse: () => Promise.reject(""),
    });
  });

  it("Should not save user if invalid target platform", async () => {
    // Setup
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser({
        contextDAO: instance(contextDAO),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => ({ additionalContext: { targetID } }),
      })({ getFinalMessageProcessor: () => instance(tlMessenger) })
    );

    // When
    await transformed.receiveRequest({
      currentContext: { targetID: targetID.toString() },
      input: { text: "", type: "text" },
      targetID: `${targetID}`,
      targetPlatform: "facebook",
      type: "message_trigger",
    });

    // Then
    verify(contextDAO.appendContext(anything())).never();
  });

  it("Should not save user if invalid request type", async () => {
    // Setup
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser({
        contextDAO: instance(contextDAO),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => ({ additionalContext: { targetID } }),
      })({ getFinalMessageProcessor: () => instance(tlMessenger) })
    );

    // When
    await transformed.receiveRequest({
      currentContext: { targetID: targetID.toString() },
      input: {
        changedContext: {},
        oldContext: {},
        newContext: {},
        type: "context_change",
      },
      targetID: `${targetID}`,
      targetPlatform: "telegram",
      type: "manual_trigger",
    });

    // Then
    verify(contextDAO.appendContext(anything())).never();
  });

  it("Should save user when no user ID is present in context", async () => {
    // Setup
    when(contextDAO.appendContext(anything())).thenResolve({
      newContext: {},
      oldContext: {},
    });

    when(tlMessenger.receiveRequest(anything())).thenResolve({});
    const additionalContext = { a: 1, b: 2 };

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser({
        contextDAO: instance(contextDAO),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => ({ additionalContext }),
      })({ getFinalMessageProcessor: () => instance(tlMessenger) })
    );

    // When
    await transformed.receiveRequest({
      currentBot: { id: 0, first_name: "", username: "" },
      currentContext: { targetID: targetID.toString() },
      input: { text: "", type: "text" },
      targetID: targetID.toString(),
      targetPlatform: "telegram",
      telegramUser: {
        id: 0,
        first_name: "",
        last_name: "",
        username: "",
        language_code: "en" as const,
        is_bot: false,
      },
      type: "message_trigger",
    });

    // Then
    verify(
      contextDAO.appendContext(
        deepEqual({
          additionalContext,
          targetID: targetID.toString(),
          targetPlatform: "telegram",
        })
      )
    ).once();
  });
});

describe("Set typing indicator", () => {
  const targetID = "target-id";

  it("Should set typing indicator when response is being sent", async () => {
    // Setup
    when(msgProcessor.sendResponse(anything())).thenResolve();
    when(client.setTypingIndicator(targetID, anything())).thenResolve();

    const transformed = await compose(
      instance(msgProcessor),
      setTypingIndicator({ client: instance(client) })(middlewareInput)
    );

    // When
    await transformed.sendResponse({
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
    verify(client.setTypingIndicator(targetID, true)).calledBefore(
      client.setTypingIndicator(targetID, false)
    );
  });

  it("Should ignore error if forced to", async () => {
    // Setup
    const config = spy<Parameters<typeof setTypingIndicator>[0]>({
      client: instance(client),
      onSetTypingError: () => {},
    });

    const error = new Error("some-error");
    when(msgProcessor.sendResponse(anything())).thenResolve();
    when(client.setTypingIndicator(targetID, anything())).thenReject(error);

    const transformed = await compose(
      instance(msgProcessor),
      setTypingIndicator(instance(config))(middlewareInput)
    );

    // When
    await transformed.sendResponse({
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
    verify(client.setTypingIndicator(targetID, true)).calledBefore(
      client.setTypingIndicator(targetID, false)
    );

    verify(config.onSetTypingError!(error)).twice();
  });
});
