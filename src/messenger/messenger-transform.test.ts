import { beforeEach, describe } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { compose } from "../common/utils";
import { PlatformClient } from "../type/client";
import { ContextDAO } from "../type/context-dao";
import { BaseMessageProcessor } from "../type/messenger";
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
let messenger: BaseMessageProcessor<{}, unknown, AmbiguousRequest<{}>>;
let client: PlatformClient<unknown>;
let contextDAO: ContextDAO<{}>;

beforeEach(async () => {
  messenger = spy<BaseMessageProcessor<{}, unknown, AmbiguousRequest<{}>>>({
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
});

describe("Save context on send", () => {
  const targetID = "target-id";

  it("Should save context on send", async () => {
    // Setup
    const oldContext: {} = { a: 1, b: 2 };
    when(contextDAO.getContext(targetID, targetPlatform)).thenResolve(
      oldContext
    );
    when(
      contextDAO.appendContext(targetID, targetPlatform, anything())
    ).thenResolve();
    when(messenger.sendResponse(anything())).thenResolve();

    const transformed = await compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const additionalContext: Partial<{}> = { a: 1, b: 2 };

    const genericResponse: AmbiguousResponse<{}> = {
      targetID,
      targetPlatform,
      additionalContext,
      output: [],
    };

    // When
    await transformed.sendResponse(genericResponse);

    // Then
    verify(
      contextDAO.appendContext(
        targetID,
        targetPlatform,
        deepEqual(additionalContext)
      )
    ).once();

    verify(messenger.sendResponse(deepEqual(genericResponse))).once();
  });
});

describe("Inject context on receive", () => {
  const targetID = "target-id";

  it("Should inject context on receive", async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };

    when(messenger.receiveRequest(anything())).thenResolve({
      targetID,
      newContext: expectedContext,
      visualContents: [],
    });

    when(contextDAO.getContext(targetID, targetPlatform)).thenResolve(
      expectedContext
    );

    const transformed = await compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO))
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
      messenger.receiveRequest(
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
    ).thenResolve({});

    when(messenger.receiveRequest(anything())).thenResolve({
      targetID,
      visualContents: [],
    });

    const additionalContext = { a: 1, b: 2 };

    const transformed = await compose(
      instance(messenger),
      saveUserForTargetID(
        instance(contextDAO),
        async () => ({ id: targetID }),
        async () => ({ additionalContext, targetUserID: targetID })
      )
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
      messenger.receiveRequest(deepEqual({ ...genericRequest, oldContext: {} }))
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
    ).thenResolve({});
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const additionalContext = { a: 1, b: 2 };

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser(instance(contextDAO), () =>
        Promise.resolve({ additionalContext, telegramUserID: targetID })
      )
    );

    // When
    await transformed.receiveRequest({
      targetID: `${targetID}`,
      telegramUser: {
        id: 0,
        first_name: "",
        last_name: "",
        username: "",
        language_code: "en" as const,
        is_bot: false,
      },
      targetPlatform: "telegram",
      oldContext: {},
      input: [],
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
    when(messenger.sendResponse(anything())).thenResolve();
    when(client.setTypingIndicator(targetID, anything())).thenResolve();

    const transformed = await compose(
      instance(messenger),
      setTypingIndicator(instance(client))
    );

    // When
    await transformed.sendResponse({
      targetID,
      targetPlatform,
      output: [],
    });

    // Then
    verify(client.setTypingIndicator(targetID, true)).calledBefore(
      client.setTypingIndicator(targetID, false)
    );
  });
});
