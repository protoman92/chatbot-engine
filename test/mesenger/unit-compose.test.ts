import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import {
  Context,
  ContextDAO,
  GenericRequest,
  GenericResponse,
  injectContextOnReceive,
  PlatformCommunicator,
  saveContextOnSend,
  saveUserForSenderID,
  setTypingIndicator,
  UnitMessenger
} from '../../src';
import { compose, joinObjects } from '../../src/common/utils';

const senderID = 'sender-id';
let messenger: UnitMessenger<Context>;
let communicator: PlatformCommunicator;
let contextDAO: ContextDAO<Context>;

beforeEach(async () => {
  messenger = spy<UnitMessenger<Context>>({
    receiveRequest: () => Promise.reject(''),
    sendResponse: () => Promise.reject('')
  });

  communicator = spy<PlatformCommunicator>({
    getUser: () => Promise.reject(''),
    sendResponse: () => Promise.reject(''),
    setTypingIndicator: () => Promise.reject('')
  });

  contextDAO = spy<ContextDAO<Context>>({
    getContext: () => Promise.reject(''),
    setContext: () => Promise.reject(''),
    resetContext: () => Promise.reject('')
  });
});

describe('Save context on send', () => {
  it('Should save context on send', async () => {
    // Setup
    const oldContext: Context = { senderID };
    when(contextDAO.getContext(senderID)).thenResolve(oldContext);
    when(contextDAO.setContext(senderID, anything())).thenResolve();
    when(messenger.sendResponse(anything())).thenResolve();

    const composed = compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const additionalContext: Partial<Context> = { a: 1, b: 2 };

    const genericResponse: GenericResponse<Context> = {
      senderID,
      additionalContext,
      visualContents: []
    };

    // When
    await composed.sendResponse(genericResponse);

    // Then
    const newContext = joinObjects(oldContext, additionalContext);
    verify(contextDAO.getContext(senderID)).once();
    verify(contextDAO.setContext(senderID, deepEqual(newContext))).once();
    verify(messenger.sendResponse(deepEqual(genericResponse))).once();
  });
});

describe('Inject context on receive', () => {
  it('Should inject context on send', async () => {
    // Setup
    const expectedContext: Context = { senderID };

    when(messenger.receiveRequest(anything())).thenResolve({
      senderID,
      newContext: expectedContext,
      visualContents: []
    });

    when(contextDAO.getContext(senderID)).thenResolve(expectedContext);

    const composed = compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO))
    );

    const genericRequest: GenericRequest<Context> = {
      senderID,
      oldContext: { senderID: '' },
      data: []
    };

    // When
    await composed.receiveRequest(genericRequest);

    // Then
    verify(contextDAO.getContext(senderID)).once();

    verify(
      messenger.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: expectedContext })
      )
    ).once();
  });
});

describe('Save user for sender ID', () => {
  it('Should save user when no user ID is present in context', async () => {
    // Setup
    const chatbotUser = { id: senderID };
    const expectedContext: Context = { senderID };

    when(messenger.receiveRequest(anything())).thenResolve({
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

    const genericRequest: GenericRequest<Context> = {
      senderID,
      oldContext: { senderID: '' },
      data: []
    };

    // When
    await composed.receiveRequest(genericRequest);

    // Then
    verify(communicator.getUser(senderID)).once();

    verify(
      messenger.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: expectedContext })
      )
    ).once();
  });
});

describe('Set typing indicator', () => {
  it('Should set typing indicator on request and response', async () => {
    // Setup

    when(messenger.receiveRequest(anything())).thenResolve({
      senderID,
      visualContents: []
    });

    when(messenger.sendResponse(anything())).thenResolve();
    when(communicator.setTypingIndicator(senderID, anything())).thenResolve();

    const composed = compose(
      instance(messenger),
      setTypingIndicator(instance(communicator))
    );

    // When
    await composed.receiveRequest({
      senderID,
      oldContext: { senderID },
      data: []
    });

    await composed.sendResponse({ senderID, visualContents: [] });

    // Then
    verify(communicator.setTypingIndicator(senderID, true)).calledBefore(
      communicator.setTypingIndicator(senderID, false)
    );
  });
});
