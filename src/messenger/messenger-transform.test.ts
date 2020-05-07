import expectJs from "expect.js";
import { beforeEach, describe } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { compose } from "../common/utils";
import { PlatformClient } from "../type/client";
import { ContextDAO } from "../type/context-dao";
import {
  BaseMessageProcessor,
  MessageProcessorMiddleware,
  OnContextChangeCallback,
} from "../type/messenger";
import { AmbiguousRequest, AmbiguousRequestPerInput } from "../type/request";
import { AmbiguousResponse } from "../type/response";
import { TelegramMessageProcessor } from "../type/telegram";
import {
  injectContextOnReceive,
  notifyLeavesOnContextChange,
  saveContextOnSend,
  saveUserForTargetID,
  setTypingIndicator,
} from "./messenger-transform";
import { saveTelegramUser } from "./telegram-transform";

const targetPlatform = "facebook";
let msgProcessor: BaseMessageProcessor<{}, unknown, AmbiguousRequest<{}>>;
let client: PlatformClient<unknown>;
let contextDAO: ContextDAO<{}>;
let middlewareInput: MessageProcessorMiddleware.Input<typeof msgProcessor>;

beforeEach(async () => {
  msgProcessor = spy<BaseMessageProcessor<{}, unknown, AmbiguousRequest<{}>>>({
    generalizeRequest: () => Promise.reject(""),
    receiveRequest: () => Promise.reject(""),
    sendResponse: () => Promise.reject(""),
  });

  client = spy<PlatformClient<unknown>>({
    sendResponse: () => Promise.reject(""),
    setTypingIndicator: () => Promise.reject(""),
  });

  contextDAO = spy<ContextDAO<{}>>({
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
    const oldCtx: {} = { a: 1, b: 2 };
    when(contextDAO.getContext(targetID, targetPlatform)).thenResolve(oldCtx);
    when(
      contextDAO.appendContext(targetID, targetPlatform, anything())
    ).thenResolve({ newContext: {} });
    when(msgProcessor.sendResponse(anything())).thenResolve();
    let callbackParameters: Parameters<OnContextChangeCallback<{}>> | undefined;

    const transformed = await compose(
      instance(msgProcessor),
      saveContextOnSend(
        instance(contextDAO),
        async (...args) => (callbackParameters = args)
      )(middlewareInput)
    );

    const additionalContext: Partial<{}> = { a: 1, b: 2 };

    const response: AmbiguousResponse<{}> = {
      targetID,
      targetPlatform,
      additionalContext,
      originalRequest: {
        targetID,
        input: {},
        oldContext: {},
        targetPlatform: "facebook",
      },
      output: [],
    };

    // When
    await transformed.sendResponse(response);

    // Then
    verify(
      contextDAO.appendContext(
        targetID,
        targetPlatform,
        deepEqual(additionalContext)
      )
    ).once();

    verify(msgProcessor.sendResponse(deepEqual(response))).once();
    expectJs(callbackParameters).to.eql([{ response, newContext: {} }]);
  });

  it("Should notify leaves when context changes", async () => {
    // Setup
    const newContext = { a: 1, b: 2 };

    const originalRequest: AmbiguousRequestPerInput<{}> = {
      targetID,
      input: {},
      oldContext: {},
      targetPlatform: "facebook",
    };

    const messengerFn = () => instance(msgProcessor);
    when(msgProcessor.receiveRequest(anything())).thenResolve({});

    // When
    await notifyLeavesOnContextChange(messengerFn)({
      newContext,
      response: {
        originalRequest,
        targetID,
        output: [],
        targetPlatform: "telegram",
      },
    });

    // Then
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          ...originalRequest,
          newContext,
          input: [{}],
          targetPlatform: "facebook",
        })
      )
    ).once();
  });
});

describe("Inject context on receive", () => {
  const targetID = "target-id";

  it("Should inject context on receive", async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };

    when(msgProcessor.receiveRequest(anything())).thenResolve({
      targetID,
      newContext: expectedContext,
      visualContents: [],
    });

    when(contextDAO.getContext(targetID, targetPlatform)).thenResolve(
      expectedContext
    );

    const transformed = await compose(
      instance(msgProcessor),
      injectContextOnReceive(instance(contextDAO))(middlewareInput)
    );

    const genericRequest: AmbiguousRequest<{}> = {
      targetID,
      targetPlatform,
      oldContext: {},
      input: [],
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(contextDAO.getContext(targetID, targetPlatform)).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: expectedContext })
      )
    ).once();
  });
});

describe("Save user for target ID", () => {
  const targetID = "target-id";

  it("Should save user when no user ID is present in context", async () => {
    // Setup
    when(
      contextDAO.appendContext(anything(), anything(), anything())
    ).thenResolve({ newContext: {} });

    when(msgProcessor.receiveRequest(anything())).thenResolve({
      targetID,
      visualContents: [],
    });

    const additionalContext = { a: 1, b: 2 };

    const transformed = await compose(
      instance(msgProcessor),
      saveUserForTargetID(
        instance(contextDAO),
        async () => ({ id: targetID }),
        async () => ({ additionalContext, targetUserID: targetID })
      )(middlewareInput)
    );

    const genericRequest: AmbiguousRequest<{}> = {
      targetID,
      targetPlatform,
      oldContext: {},
      input: [],
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(
      contextDAO.appendContext(
        targetID,
        targetPlatform,
        deepEqual({ ...additionalContext, targetID })
      )
    ).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: {} })
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

  it("Should save user when no user ID is present in context", async () => {
    // Setup
    when(
      contextDAO.appendContext(anything(), anything(), anything())
    ).thenResolve({ newContext: {} });
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const additionalContext = { a: 1, b: 2 };

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser(instance(contextDAO), () =>
        Promise.resolve({ additionalContext, telegramUserID: targetID })
      )({ getFinalMessageProcessor: () => instance(tlMessenger) })
    );

    // When
    await transformed.receiveRequest({
      currentBot: { id: 0, first_name: "", username: "" },
      input: [],
      oldContext: {},
      targetID: `${targetID}`,
      targetPlatform: "telegram",
      telegramUser: {
        id: 0,
        first_name: "",
        last_name: "",
        username: "",
        language_code: "en" as const,
        is_bot: false,
      },
    });

    // Then
    verify(
      contextDAO.appendContext(
        `${targetID}`,
        "telegram",
        deepEqual({ ...additionalContext, targetID: `${targetID}` })
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
      setTypingIndicator(instance(client))(middlewareInput)
    );

    // When
    await transformed.sendResponse({
      targetID,
      targetPlatform,
      originalRequest: {
        targetID,
        input: {},
        oldContext: {},
        targetPlatform: "facebook",
      },
      output: [],
    });

    // Then
    verify(client.setTypingIndicator(targetID, true)).calledBefore(
      client.setTypingIndicator(targetID, false)
    );
  });
});
