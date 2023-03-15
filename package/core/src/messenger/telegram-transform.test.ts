import { mockSomething } from "@haipham/javascript-helper-test-utils";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { transform } from "../common/utils";
import { createInMemoryContextDAO } from "../context/InMemoryContextDAO";
import {
  AmbiguousGenericRequest,
  ContextDAO,
  TelegramBot,
  TelegramGenericRequest,
  TelegramGenericResponse,
  TelegramMessageProcessor,
  TelegramRawRequest,
  TelegramUser,
  _MessageProcessorMiddleware,
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
        originalRequest: {} as AmbiguousGenericRequest,
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
        originalRequest: {} as AmbiguousGenericRequest,
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
  let saveMessages: jest.Mock;

  beforeEach(() => {
    contextDAO = createInMemoryContextDAO();
    saveMessages = jest.fn();
  });

  it("Should save Telegram messages when receiving a callback_query request", async () => {
    // Setup
    const receiveRequest = jest.fn();

    const transformed = await transform(
      mockSomething<typeof msgProcessor>({ receiveRequest }),
      saveTelegramMessages({
        contextDAO,
        saveMessages,
        isEnabled: () => {
          return true;
        },
      })({
        getFinalMessageProcessor: () => {
          return mockSomething<typeof msgProcessor>({});
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: mockSomething<TelegramGenericRequest>({
        targetID,
        targetPlatform,
        currentContext: {},
        rawRequest: { callback_query: { message: { text: "some-text" } } },
        triggerType: "message",
      }),
    });

    // Then
    expect.assertions(4);
    expect(receiveRequest).toHaveBeenCalledTimes(1);
    expect(receiveRequest).toHaveBeenCalledWith({
      genericRequest: {
        targetID,
        currentContext: {},
        rawRequest: { callback_query: { message: { text: "some-text" } } },
        targetPlatform: "telegram",
        triggerType: "message",
      },
    });
    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(saveMessages).toHaveBeenNthCalledWith(1, {
      currentContext: {},
      rawRequestMessages: [{ text: "some-text" }],
    });
  });

  it("Should not save Telegram messages when receiving a my_chat_member request", async () => {
    // Setup
    const receiveRequest = jest.fn();

    const transformed = await transform(
      mockSomething<typeof msgProcessor>({ receiveRequest }),
      saveTelegramMessages({
        contextDAO,
        saveMessages,
        isEnabled: () => {
          return true;
        },
      })({
        getFinalMessageProcessor: () => {
          return mockSomething<typeof msgProcessor>({});
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: mockSomething<TelegramGenericRequest>({
        targetID,
        targetPlatform,
        currentContext: {},
        rawRequest: { my_chat_member: {} },
        triggerType: "message",
      }),
    });

    // Then
    expect.assertions(3);
    expect(receiveRequest).toHaveBeenCalledTimes(1);
    expect(receiveRequest).toHaveBeenCalledWith({
      genericRequest: {
        targetID,
        currentContext: {},
        rawRequest: { my_chat_member: {} },
        targetPlatform: "telegram",
        triggerType: "message",
      },
    });
    expect(saveMessages).not.toHaveBeenCalled();
  });

  it("Should not save Telegram messages when receiving a pre_checkout_query request", async () => {
    // Setup
    const receiveRequest = jest.fn();

    const transformed = await transform(
      mockSomething<typeof msgProcessor>({ receiveRequest }),
      saveTelegramMessages({
        contextDAO,
        saveMessages,
        isEnabled: () => {
          return true;
        },
      })({
        getFinalMessageProcessor: () => {
          return mockSomething<typeof msgProcessor>({});
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: mockSomething<TelegramGenericRequest>({
        targetID,
        targetPlatform,
        currentContext: {},
        rawRequest: { pre_checkout_query: {} },
        triggerType: "message",
      }),
    });

    // Then
    expect.assertions(3);
    expect(receiveRequest).toHaveBeenCalledTimes(1);
    expect(receiveRequest).toHaveBeenCalledWith({
      genericRequest: {
        targetID,
        currentContext: {},
        rawRequest: { pre_checkout_query: {} },
        targetPlatform: "telegram",
        triggerType: "message",
      },
    });
    expect(saveMessages).not.toHaveBeenCalled();
  });

  it("Should save Telegram messages when receiving a normal message request", async () => {
    // Setup
    const receiveRequest = jest.fn();

    const transformed = await transform(
      mockSomething<typeof msgProcessor>({ receiveRequest }),
      saveTelegramMessages({
        contextDAO,
        saveMessages,
        isEnabled: () => {
          return true;
        },
      })({
        getFinalMessageProcessor: () => {
          return mockSomething<typeof msgProcessor>({});
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: mockSomething<TelegramGenericRequest>({
        targetID,
        targetPlatform,
        currentContext: {},
        rawRequest: { message: { text: "some-text" } },
        triggerType: "message",
      }),
    });

    // Then
    expect.assertions(4);
    expect(receiveRequest).toHaveBeenCalledTimes(1);
    expect(receiveRequest).toHaveBeenCalledWith({
      genericRequest: {
        targetID,
        currentContext: {},
        rawRequest: { message: { text: "some-text" } },
        targetPlatform: "telegram",
        triggerType: "message",
      },
    });
    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(saveMessages).toHaveBeenNthCalledWith(1, {
      currentContext: {},
      rawRequestMessages: [{ text: "some-text" }],
    });
  });

  it("Should save Telegram messages when sending response", async () => {
    // Setup
    const sendResponse = jest.fn();

    sendResponse.mockResolvedValueOnce([
      { data: "some-data-1" },
      { data: "some-data-2" },
      true,
    ]);

    const transformed = await transform(
      mockSomething<typeof msgProcessor>({ sendResponse }),
      saveTelegramMessages({
        contextDAO,
        saveMessages,
        isEnabled: () => {
          return true;
        },
      })({
        getFinalMessageProcessor: () => {
          return mockSomething<typeof msgProcessor>({});
        },
      })
    );

    // When
    await transformed.sendResponse({
      genericResponse: mockSomething<TelegramGenericResponse>({
        targetID,
        targetPlatform,
      }),
    });

    // Then
    expect.assertions(4);
    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(saveMessages).toHaveBeenCalledWith({
      currentContext: {},
      rawRequestMessages: [{ data: "some-data-1" }, { data: "some-data-2" }],
    });
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({
      genericResponse: { targetID, targetPlatform: "telegram" },
    });
  });

  it("Should not trigger if not enabled", async () => {
    // Setup
    const receiveRequest = jest.fn();
    const sendResponse = jest.fn();

    const transformed = await transform(
      mockSomething<typeof msgProcessor>({ receiveRequest, sendResponse }),
      saveTelegramMessages({
        contextDAO,
        saveMessages,
        isEnabled: () => {
          return false;
        },
      })({
        getFinalMessageProcessor: () => {
          return mockSomething<typeof msgProcessor>({});
        },
      })
    );

    // When
    await transformed.receiveRequest({
      genericRequest: mockSomething<TelegramGenericRequest>({
        triggerType: "message",
      }),
    });

    await transformed.sendResponse({
      genericResponse: mockSomething<TelegramGenericResponse>({}),
    });

    // Then
    expect.assertions(5);
    expect(receiveRequest).toHaveBeenCalledTimes(1);
    expect(receiveRequest).toHaveBeenCalledWith({
      genericRequest: { triggerType: "message" },
    });
    expect(saveMessages).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ genericResponse: {} });
  });
});
