import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { transform } from "../common/utils";
import {
  ContextDAO,
  TelegramBot,
  TelegramGenericRequest,
  TelegramGenericResponse,
  TelegramMessageProcessor,
  TelegramRawRequest,
  TelegramUser,
  _MessageProcessorMiddleware,
  _TelegramRawRequest,
} from "../type";
import {
  injectTelegramContextOnReceive,
  saveTelegramMessages,
  saveTelegramUser,
} from "./telegram-transform";

declare module ".." {
  interface ChatbotContext extends Record<string, unknown> {}
}

const targetID = "target-id";
const targetPlatform = "telegram";
let msgProcessor: TelegramMessageProcessor;
let contextDAO: ContextDAO;
let middlewareInput: _MessageProcessorMiddleware.Input;

beforeEach(async () => {
  msgProcessor = spy<TelegramMessageProcessor>({
    generalizeRequest: () => {
      return Promise.reject("generalizeRequest");
    },
    receiveRequest: () => {
      return Promise.reject("receiveRequest");
    },
    sendResponse: () => {
      return Promise.reject("sendResponse");
    },
  });

  contextDAO = spy<ContextDAO>({
    getContext: () => {
      return Promise.reject("getContext");
    },
    appendContext: () => {
      return Promise.reject("appendContext");
    },
    resetContext: () => {
      return Promise.reject("resetContext");
    },
  });

  middlewareInput = {
    getFinalMessageProcessor: () => {
      return instance(msgProcessor);
    },
  };
});

describe("Inject context on receive", () => {
  it("Should not inject context on receive if invalid request type", async () => {
    // Setup
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      injectTelegramContextOnReceive({ contextDAO: instance(contextDAO) })(
        middlewareInput
      )
    );

    // When
    await transformed.receiveRequest({
      genericRequest: {
        targetID,
        targetPlatform,
        currentContext: {},
        input: {
          changedContext: {},
          oldContext: {},
          newContext: {},
          type: "context_change",
        },
        triggerType: "manual",
      },
    });

    // Then
    verify(contextDAO.getContext(anything())).never();
    verify(msgProcessor.receiveRequest(anything())).once();
  });

  it("Should inject context on receive", async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };

    const genericRequest: TelegramGenericRequest = {
      targetID,
      targetPlatform,
      chatType: "private",
      currentBot: {} as TelegramBot,
      currentContext: {},
      input: { text: "", type: "text" },
      rawRequest: {} as TelegramRawRequest,
      telegramUser: { id: 1 } as TelegramUser,
      triggerType: "message",
    };

    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);
    when(
      contextDAO.getContext(
        deepEqual({
          targetPlatform,
          targetID: genericRequest.telegramUser.id.toString(),
        })
      )
    ).thenResolve(expectedContext);

    const transformed = await transform(
      instance(msgProcessor),
      injectTelegramContextOnReceive({ contextDAO: instance(contextDAO) })(
        middlewareInput
      )
    );

    // When
    await transformed.receiveRequest({ genericRequest });

    // Then
    verify(
      contextDAO.getContext(
        deepEqual({
          targetPlatform,
          targetID: genericRequest.telegramUser.id.toString(),
        })
      )
    ).once();
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          genericRequest: {
            ...genericRequest,
            currentContext: expectedContext,
          },
        })
      )
    ).once();
  });
});

describe("Save Telegram user for target ID", () => {
  it("Should not save user if invalid request type", async () => {
    // Setup
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      saveTelegramUser({
        contextDAO: instance(contextDAO),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => {
          return { additionalContext: { targetID } };
        },
      })({ getFinalMessageProcessor: () => instance(msgProcessor) })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: {
        currentContext: { targetID: targetID.toString() },
        input: {
          changedContext: {},
          oldContext: {},
          newContext: {},
          type: "context_change",
        },
        targetID: `${targetID}`,
        targetPlatform: "telegram",
        triggerType: "manual",
      },
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

    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);
    const additionalContext = { a: 1, b: 2 };

    const transformed = await transform(
      instance(msgProcessor),
      saveTelegramUser({
        contextDAO: instance(contextDAO),
        isEnabled: async ({ currentContext: { targetID } }) => {
          return !!targetID;
        },
        saveUser: async () => {
          return { additionalContext };
        },
      })({
        getFinalMessageProcessor: () => {
          return instance(msgProcessor);
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: {
        chatType: "private",
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
        rawRequest: {} as TelegramRawRequest,
        triggerType: "message",
      },
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

describe("Save Telegram messages", () => {
  let saveTelegramMessageArgs: Parameters<typeof saveTelegramMessages>[0];

  beforeEach(() => {
    saveTelegramMessageArgs = spy<typeof saveTelegramMessageArgs>({
      contextDAO: instance(contextDAO),
      isEnabled: () => {
        return Promise.reject("");
      },
      saveMessages: () => {
        return Promise.reject("");
      },
    });
  });

  it("Should allow saving Telegram messages when appropriate", async () => {
    // Setup
    const inRawRequest = {
      callback_query: { message: {} },
    } as _TelegramRawRequest.Callback;

    const outRawRequest = { message: {} } as _TelegramRawRequest.Message;
    when(contextDAO.getContext(anything())).thenResolve({});
    when(saveTelegramMessageArgs.isEnabled()).thenReturn(true);
    when(saveTelegramMessageArgs.saveMessages(anything())).thenResolve(
      undefined
    );
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);
    when(msgProcessor.sendResponse(anything())).thenResolve([
      outRawRequest.message,
    ]);

    const transformed = await transform(
      instance(msgProcessor),
      saveTelegramMessages(instance(saveTelegramMessageArgs))({
        getFinalMessageProcessor: () => {
          return instance(msgProcessor);
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: {
        targetID,
        targetPlatform,
        currentContext: {},
        rawRequest: inRawRequest,
        triggerType: "message",
      } as TelegramGenericRequest,
    });

    await transformed.receiveRequest({
      genericRequest: {
        targetID,
        targetPlatform,
        triggerType: "manual",
      } as TelegramGenericRequest,
    });

    await transformed.sendResponse({
      genericResponse: { targetID, targetPlatform } as TelegramGenericResponse,
    });

    // Then
    verify(
      saveTelegramMessageArgs.saveMessages(
        deepEqual({
          currentContext: {},
          rawRequestMessages: [inRawRequest.callback_query.message],
        })
      )
    ).twice();
    verify(
      contextDAO.getContext(deepEqual({ targetID, targetPlatform }))
    ).once();
  });

  it("Should not trigger if not enabled", async () => {
    // Setup
    when(saveTelegramMessageArgs.isEnabled()).thenReturn(false);
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);
    when(msgProcessor.sendResponse(anything())).thenResolve([
      {} as _TelegramRawRequest.Message["message"],
    ]);

    const transformed = await transform(
      instance(msgProcessor),
      saveTelegramMessages(instance(saveTelegramMessageArgs))({
        getFinalMessageProcessor: () => {
          return instance(msgProcessor);
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: { triggerType: "message" } as TelegramGenericRequest,
    });

    await transformed.sendResponse({
      genericResponse: {} as TelegramGenericResponse,
    });

    // Then
    verify(saveTelegramMessageArgs.saveMessages(anything())).never();
    verify(contextDAO.getContext(anything())).never;
  });
});
