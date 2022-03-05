import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { joinObjects, transform } from "../common/utils";
import {
  AmbiguousGenericRequest,
  AmbiguousGenericResponse,
  BaseMessageProcessor,
  ContextDAO,
  FacebookRawRequest,
  PlatformClient,
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
let client: PlatformClient<unknown>;
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

  client = spy<PlatformClient<unknown>>({
    sendResponse: () => {
      return Promise.reject("");
    },
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
  it("Should save context on send", async () => {
    // Setup
    const oldContext: {} = { a: 1, b: 2 };
    const additionalContext: {} = { a: 1, b: 2, c: 3 };
    const finalContext = joinObjects(oldContext, additionalContext);

    when(contextDAO.appendContext(anything())).thenResolve({
      oldContext,
      newContext: finalContext,
    });
    when(msgProcessor.sendResponse(anything())).thenResolve(undefined);
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      saveContextOnSend({ contextDAO: instance(contextDAO) })(middlewareInput)
    );

    const genericResponse: AmbiguousGenericResponse = {
      targetID,
      additionalContext,
      originalRequest: {
        currentContext: {},
        input: { text: "", type: "text" },
        targetID: "some-other-id",
        rawRequest: {} as FacebookRawRequest,
        targetPlatform: "facebook",
        type: "message_trigger",
      },
      output: [],
      targetPlatform: "telegram",
    };

    // When
    await transformed.sendResponse({ genericResponse });

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
    verify(msgProcessor.sendResponse(deepEqual({ genericResponse }))).once();
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          genericRequest: {
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
        type: "manual_trigger",
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
      type: "message_trigger",
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
          type: "message_trigger",
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
          type: "message_trigger",
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
