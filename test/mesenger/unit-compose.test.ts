import { describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito-2';
import { compose } from '../../src/common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForSenderID
} from '../../src/messenger/unit-compose';
import { Context } from '../../src/type/common';
import { ContextDAO } from '../../src/type/context-dao';
import {
  GenericRequest,
  UnitMessenger,
  PlatformResponse
} from '../../src/type/messenger';
import { ServiceCommunicator } from '../../src/type/communicator';

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

    const newContext: BotContext = { userID: `${senderID}-2` };

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
    const expectedContext: BotContext = { userID: `${senderID}-2` };

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
      oldContext: { userID: '' },
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
    interface CUser {
      readonly id: string;
    }

    const chatbotUser: CUser = { id: `${senderID}-2` };
    const expectedContext: BotContext = { userID: chatbotUser.id };

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
      saveUserForSenderID<BotContext, {}, CUser>(
        instance(communicator),
        async () => chatbotUser,
        ({ id }) => id
      )
    );

    const genericRequest: GenericRequest<BotContext> = {
      senderID,
      oldContext: { userID: '' },
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
