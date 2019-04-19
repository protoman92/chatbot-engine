import { describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { compose } from '../../src/common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForSenderID,
  setTypingIndicator
} from '../../src/messenger/unit-compose';
import { Context } from '../../src/type/common';
import { ServiceCommunicator } from '../../src/type/communicator';
import { ContextDAO } from '../../src/type/context-dao';
import {
  GenericRequest,
  PlatformResponse,
  UnitMessenger
} from '../../src/type/messenger';

interface BotContext extends Context {}

const senderID = 'sender-id';
const cacheKey = `cache-${senderID}`;
let messenger: UnitMessenger<BotContext>;
let communicator: ServiceCommunicator;
let contextDAO: ContextDAO<BotContext>;

before(async () => {
  messenger = spy<UnitMessenger<BotContext>>({
    getContextDAOCacheKey: () => cacheKey,
    mapGenericRequest: () => Promise.reject(''),
    sendPlatformResponse: () => Promise.reject('')
  });

  communicator = spy<ServiceCommunicator>({
    getUser: () => Promise.reject(''),
    sendResponse: () => Promise.reject(''),
    setTypingIndicator: () => Promise.reject('')
  });

  contextDAO = spy<ContextDAO<BotContext>>({
    getContext: () => Promise.reject(''),
    setContext: () => Promise.reject(''),
    resetAll: () => Promise.reject('')
  });
});

describe('Save context on send', () => {
  it('Should save context on send', async () => {
    // Setup
    when(messenger.sendPlatformResponse(anything())).thenReturn(
      Promise.resolve()
    );

    when(contextDAO.setContext(cacheKey, anything())).thenReturn(
      Promise.resolve()
    );

    const newContext: BotContext = { senderID };

    const composed = compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const platformResponse: PlatformResponse<BotContext> = {
      senderID,
      newContext,
      outgoingData: []
    };

    // When
    await composed.sendPlatformResponse(platformResponse);

    // Then
    verify(contextDAO.setContext(cacheKey, deepEqual(newContext))).once();
    verify(messenger.sendPlatformResponse(deepEqual(platformResponse))).once();
  });
});

describe('Inject context on receive', () => {
  it('Should inject context on send', async () => {
    // Setup
    const expectedContext: BotContext = { senderID };

    when(messenger.mapGenericRequest(anything())).thenReturn(
      Promise.resolve({
        senderID,
        newContext: expectedContext,
        outgoingContents: []
      })
    );

    when(contextDAO.getContext(cacheKey)).thenReturn(
      Promise.resolve(expectedContext)
    );

    const composed = compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO))
    );

    const genericRequest: GenericRequest<BotContext> = {
      senderID,
      oldContext: { senderID: '' },
      data: []
    };

    // When
    await composed.mapGenericRequest(genericRequest);

    // Then
    verify(contextDAO.getContext(cacheKey)).once();

    verify(
      messenger.mapGenericRequest(
        deepEqual({ ...genericRequest, oldContext: expectedContext })
      )
    ).once();
  });
});

describe('Save user for sender ID', () => {
  it('Should save user when no user ID is present in context', async () => {
    // Setup
    const chatbotUser = { id: senderID };
    const expectedContext: BotContext = { senderID };

    when(messenger.mapGenericRequest(anything())).thenReturn(
      Promise.resolve({
        senderID,
        newContext: expectedContext,
        outgoingContents: []
      })
    );

    when(communicator.getUser(senderID)).thenReturn(
      Promise.resolve(chatbotUser)
    );

    const composed = compose(
      instance(messenger),
      saveUserForSenderID(
        instance(communicator),
        async () => chatbotUser,
        ({ id }) => id
      )
    );

    const genericRequest: GenericRequest<BotContext> = {
      senderID,
      oldContext: { senderID: '' },
      data: []
    };

    // When
    await composed.mapGenericRequest(genericRequest);

    // Then
    verify(communicator.getUser(senderID)).once();

    verify(
      messenger.mapGenericRequest(
        deepEqual({ ...genericRequest, oldContext: expectedContext })
      )
    ).once();
  });
});

describe('Set typing indicator', () => {
  it('Should set typing indicator on request and response', async () => {
    // Setup
    const oldContext: BotContext = { senderID };

    when(messenger.mapGenericRequest(anything())).thenReturn(
      Promise.resolve({
        senderID,
        newContext: oldContext,
        outgoingContents: []
      })
    );

    when(messenger.sendPlatformResponse(anything())).thenReturn(
      Promise.resolve()
    );

    when(communicator.setTypingIndicator(senderID, anything())).thenReturn(
      Promise.resolve()
    );

    const composed = compose(
      instance(messenger),
      setTypingIndicator(instance(communicator))
    );

    // When
    await composed.mapGenericRequest({ senderID, oldContext, data: [] });

    await composed.sendPlatformResponse({
      senderID,
      newContext: oldContext,
      outgoingData: []
    });

    // Then
    verify(communicator.setTypingIndicator(senderID, true)).calledBefore(
      communicator.setTypingIndicator(senderID, false)
    );
  });
});
