import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import {
  compose,
  Context,
  ContextDAO,
  GenericRequest,
  injectContextOnReceive,
  PlatformResponse,
  saveContextOnSend,
  saveUserForSenderID,
  ServiceCommunicator,
  setTypingIndicator,
  UnitMessenger
} from '../../src';
import { getContextDAOCacheKey } from '../../src/common/utils';

interface TestContext extends Context {}

const senderID = 'sender-id';
const cacheKey = getContextDAOCacheKey('FACEBOOK', senderID);
let messenger: UnitMessenger<TestContext>;
let communicator: ServiceCommunicator;
let contextDAO: ContextDAO<TestContext>;

beforeEach(async () => {
  messenger = spy<UnitMessenger<TestContext>>({
    mapGenericRequest: () => Promise.reject(''),
    sendPlatformResponse: () => Promise.reject('')
  });

  communicator = spy<ServiceCommunicator>({
    getUser: () => Promise.reject(''),
    sendResponse: () => Promise.reject(''),
    setTypingIndicator: () => Promise.reject('')
  });

  contextDAO = spy<ContextDAO<TestContext>>({
    getContext: () => Promise.reject(''),
    setContext: () => Promise.reject(''),
    resetAll: () => Promise.reject('')
  });
});

describe('Save context on send', () => {
  it('Should save context on send', async () => {
    // Setup
    when(messenger.sendPlatformResponse(anything())).thenResolve();
    when(contextDAO.setContext(cacheKey, anything())).thenResolve();
    const newContext: TestContext = { senderID };

    const composed = compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO), 'FACEBOOK')
    );

    const platformResponse: PlatformResponse<TestContext> = {
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
    const expectedContext: TestContext = { senderID };

    when(messenger.mapGenericRequest(anything())).thenResolve({
      senderID,
      newContext: expectedContext,
      visualContents: []
    });

    when(contextDAO.getContext(cacheKey)).thenResolve(expectedContext);

    const composed = compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO), 'FACEBOOK')
    );

    const genericRequest: GenericRequest<TestContext> = {
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
    const expectedContext: TestContext = { senderID };

    when(messenger.mapGenericRequest(anything())).thenResolve({
      senderID,
      newContext: expectedContext,
      visualContents: []
    });

    when(communicator.getUser(senderID)).thenResolve(chatbotUser);

    const composed = compose(
      instance(messenger),
      saveUserForSenderID(
        instance(communicator),
        async () => chatbotUser,
        ({ id }) => id
      )
    );

    const genericRequest: GenericRequest<TestContext> = {
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
    const oldContext: TestContext = { senderID };

    when(messenger.mapGenericRequest(anything())).thenResolve({
      senderID,
      newContext: oldContext,
      visualContents: []
    });

    when(messenger.sendPlatformResponse(anything())).thenResolve();
    when(communicator.setTypingIndicator(senderID, anything())).thenResolve();

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
