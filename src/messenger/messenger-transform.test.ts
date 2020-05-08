import { beforeEach, describe } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { compose, joinObjects } from "../common/utils";
import { PlatformClient } from "../type/client";
import { ContextDAO } from "../type/context-dao";
import {
  BaseMessageProcessor,
  MessageProcessorMiddleware,
} from "../type/messenger";
import { AmbiguousRequest } from "../type/request";
import { AmbiguousResponse } from "../type/response";
import { TelegramMessageProcessor } from "../type/telegram";
import {
  injectContextOnReceive,
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
    const oldContext: {} = { a: 1, b: 2 };
    const additionalContext: {} = { a: 1, b: 2, c: 3 };
    const finalContext = joinObjects(oldContext, additionalContext);
    when(
      contextDAO.appendContext(anything(), anything(), anything())
    ).thenResolve({ oldContext, newContext: finalContext });
    when(msgProcessor.sendResponse(anything())).thenResolve();
    when(msgProcessor.receiveRequest(anything())).thenResolve();

    const transformed = await compose(
      instance(msgProcessor),
      saveContextOnSend(instance(contextDAO))(middlewareInput)
    );

    const response: AmbiguousResponse<{}> = {
      targetID,
      additionalContext,
      originalRequest: {
        currentContext: {},
        input: {},
        targetID: "some-other-id",
        targetPlatform: "facebook",
      },
      output: [],
      targetPlatform: "telegram",
    };

    // When
    await transformed.sendResponse(response);

    // Then
    verify(
      contextDAO.appendContext(
        targetID,
        "telegram",
        deepEqual(additionalContext)
      )
    ).once();

    verify(msgProcessor.sendResponse(deepEqual(response))).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          ...response.originalRequest,
          oldContext,
          changedContext: additionalContext,
          input: [{}],
          newContext: finalContext,
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
      currentContext: {},
      input: [],
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(contextDAO.getContext(targetID, targetPlatform)).once();

    verify(
      msgProcessor.receiveRequest(
        deepEqual({ ...genericRequest, currentContext: expectedContext })
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
    ).thenResolve({ newContext: {}, oldContext: {} });

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
      currentContext: {},
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
        deepEqual({ ...genericRequest, currentContext: {} })
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
    ).thenResolve({ newContext: {}, oldContext: {} });
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const additionalContext = { a: 1, b: 2 };

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser(instance(contextDAO), async () => ({
        additionalContext,
        telegramUserID: targetID,
      }))({ getFinalMessageProcessor: () => instance(tlMessenger) })
    );

    // When
    await transformed.receiveRequest({
      currentBot: { id: 0, first_name: "", username: "" },
      currentContext: {},
      input: [],
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

  it("Should not save targetID if it's somehow null", async () => {
    // Setup
    when(
      contextDAO.appendContext(anything(), anything(), anything())
    ).thenResolve({ newContext: {}, oldContext: {} });
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser(instance(contextDAO), async () => ({
        telegramUserID: undefined as any,
      }))({ getFinalMessageProcessor: () => instance(tlMessenger) })
    );

    // When
    await transformed.receiveRequest({
      currentBot: { id: 0, first_name: "", username: "" },
      currentContext: {},
      input: [],
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
        deepEqual({ targetID: undefined })
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
        currentContext: {},
        input: {},
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
