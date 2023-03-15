import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { transform } from "../common/utils";
import { createInMemoryContextDAO } from "../context/InMemoryContextDAO";
import {
  AmbiguousGenericRequest,
  AmbiguousGenericResponse,
  BaseMessageProcessor,
  ContextDAO,
  FacebookRawRequest,
  PlatformClientTypingIndicatorSetter,
  _MessageProcessorMiddleware,
} from "../type";
import {
  saveContextOnSend,
  saveUserForTargetID,
  setTypingIndicator,
} from "./messenger-transform";

declare module ".." {
  interface ChatbotContext extends Record<string, unknown> {}
}

const targetID = "target-id";
const targetPlatform = "facebook";
let msgProcessor: BaseMessageProcessor;
let client: PlatformClientTypingIndicatorSetter;
let contextDAO: ContextDAO;
let middlewareInput: _MessageProcessorMiddleware.Input;

beforeEach(async () => {
  msgProcessor = spy<BaseMessageProcessor>({
    generalizeRequest: () => {
      return Promise.reject("");
    },
    receiveRequest: () => {
      return Promise.reject("");
    },
    sendResponse: () => {
      return Promise.reject("");
    },
  });

  client = spy<typeof client>({
    setTypingIndicator: () => {
      return Promise.reject("");
    },
  });

  contextDAO = spy<ContextDAO>({
    getContext: () => {
      return Promise.reject("");
    },
    appendContext: () => {
      return Promise.reject("");
    },
    resetContext: () => {
      return Promise.reject("");
    },
  });

  middlewareInput = {
    getFinalMessageProcessor: () => {
      return instance(msgProcessor);
    },
  };
});

describe("Save context on send", () => {
  beforeEach(() => {
    contextDAO = createInMemoryContextDAO();
  });

  it("Should save context on send", async () => {
    // Setup
    when(msgProcessor.sendResponse(anything())).thenResolve(undefined);
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      saveContextOnSend({ contextDAO })(middlewareInput)
    );

    const genericResponse: AmbiguousGenericResponse = {
      targetID,
      additionalContext: { a: 3, b: 4, c: 5 },
      originalRequest: {
        currentContext: { a: 1, b: 2 },
        input: { text: "", type: "text" },
        targetID: "some-other-id",
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        triggerType: "message",
      },
      output: [],
      targetPlatform: "facebook",
    };

    // When
    await transformed.sendResponse({ genericResponse });

    // Then
    verify(msgProcessor.sendResponse(deepEqual({ genericResponse }))).once();
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          genericRequest: {
            targetID,
            currentContext: { a: 3, b: 4, c: 5 },
            input: {
              oldContext: { a: 1, b: 2 },
              changedContext: { a: 3, b: 4, c: 5 },
              newContext: { a: 3, b: 4, c: 5 },
              type: "context_change",
            },
            originalRequest: genericResponse.originalRequest,
            targetPlatform: "facebook",
            triggerType: "manual",
          },
        })
      )
    ).once();
  });

  it("Should modify context before saving if preSaveContextMapper is provided", async () => {
    // Setup
    when(msgProcessor.sendResponse(anything())).thenResolve(undefined);
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      saveContextOnSend({
        contextDAO,
        preSaveContextMapper: (context) => {
          return { ...context, d: 4 };
        },
      })(middlewareInput)
    );

    const genericResponse: AmbiguousGenericResponse = {
      targetID,
      additionalContext: { a: 1, b: 2, c: 3 },
      originalRequest: {
        currentContext: { a: 1, b: 2 },
        input: { text: "", type: "text" },
        targetID: "some-other-id",
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        triggerType: "message",
      },
      output: [],
      targetPlatform: "facebook",
    };

    // When
    await transformed.sendResponse({ genericResponse });

    // Then
    verify(msgProcessor.sendResponse(deepEqual({ genericResponse }))).once();
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          genericRequest: {
            targetID,
            currentContext: { a: 1, b: 2, c: 3, d: 4 },
            input: {
              oldContext: { a: 1, b: 2 },
              changedContext: { a: 1, b: 2, c: 3, d: 4 },
              newContext: { a: 1, b: 2, c: 3, d: 4 },
              type: "context_change",
            },
            originalRequest: genericResponse.originalRequest,
            targetPlatform: "facebook",
            triggerType: "manual",
          },
        })
      )
    ).once();
  });
});

describe("Save user for target ID", () => {
  it("Should not save user if invalid request type", async () => {
    // Setup
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      saveUserForTargetID({
        contextDAO: instance(contextDAO),
        getUser: async () => {
          return { id: targetID };
        },
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => {
          return { additionalContext: { targetID } };
        },
      })(middlewareInput)
    );

    // When
    await transformed.receiveRequest({
      genericRequest: {
        targetID,
        targetPlatform,
        currentContext: { targetID },
        input: {
          changedContext: {},
          oldContext: {},
          newContext: {},
          type: "context_change",
        },
        originalRequest: {} as AmbiguousGenericRequest,
        triggerType: "manual",
      },
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
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      saveUserForTargetID({
        contextDAO: instance(contextDAO),
        getUser: async () => {
          return { id: targetID };
        },
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => {
          return { additionalContext };
        },
      })(middlewareInput)
    );

    const genericRequest: AmbiguousGenericRequest = {
      targetID,
      targetPlatform,
      currentContext: { targetID },
      input: { text: "", type: "text" },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message",
    };

    // When
    await transformed.receiveRequest({ genericRequest });

    // Then
    verify(
      contextDAO.appendContext(
        deepEqual({ additionalContext, targetID, targetPlatform })
      )
    ).once();
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          genericRequest: {
            ...genericRequest,
            currentContext: additionalContext,
          },
        })
      )
    ).once();
  });
});

describe("Set typing indicator", () => {
  it("Should set typing indicator when response is being sent", async () => {
    // Setup
    when(msgProcessor.sendResponse(anything())).thenResolve();
    when(client.setTypingIndicator(targetID, anything())).thenResolve();

    const transformed = await transform(
      instance(msgProcessor),
      setTypingIndicator({ client: instance(client) })(middlewareInput)
    );

    // When
    await transformed.sendResponse({
      genericResponse: {
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
      },
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

    const transformed = await transform(
      instance(msgProcessor),
      setTypingIndicator(instance(config))(middlewareInput)
    );

    // When
    await transformed.sendResponse({
      genericResponse: {
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
      },
    });

    // Then
    verify(client.setTypingIndicator(targetID, true)).calledBefore(
      client.setTypingIndicator(targetID, false)
    );
    verify(config.onSetTypingError!(error)).twice();
  });
});
