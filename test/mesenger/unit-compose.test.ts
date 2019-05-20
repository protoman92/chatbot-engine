import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { compose, joinObjects } from '../../src/common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForSenderID,
  setTypingIndicator
} from '../../src/messenger/unit-transform';
import { DefaultContext, KV } from '../../src/type/common';
import { PlatformCommunicator } from '../../src/type/communicator';
import { ContextDAO } from '../../src/type/context-dao';
import { UnitMessenger } from '../../src/type/messenger';
import { GenericRequest } from '../../src/type/request';
import { GenericResponse } from '../../src/type/response';

interface Context extends KV<unknown> {}

const senderID = 'sender-id';
const senderPlatform = 'facebook';
let messenger: UnitMessenger<Context>;
let communicator: PlatformCommunicator<unknown>;
let contextDAO: ContextDAO<Context>;

beforeEach(async () => {
  messenger = spy<UnitMessenger<Context>>({
    receiveRequest: () => Promise.reject(''),
    sendResponse: () => Promise.reject('')
  });

  communicator = spy<PlatformCommunicator<unknown>>({
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
    const oldContext: Context = { a: 1, b: 2 };
    when(contextDAO.getContext(senderID)).thenResolve(oldContext);
    when(contextDAO.setContext(senderID, anything())).thenResolve();
    when(messenger.sendResponse(anything())).thenResolve();

    const transformed = compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const additionalContext: Partial<Context> = { a: 1, b: 2 };

    const genericResponse: GenericResponse<Context> = {
      senderID,
      senderPlatform,
      additionalContext,
      visualContents: []
    };

    // When
    await transformed.sendResponse(genericResponse);

    // Then
    const newContext = joinObjects(oldContext, additionalContext);
    verify(contextDAO.getContext(senderID)).once();
    verify(contextDAO.setContext(senderID, deepEqual(newContext))).once();
    verify(messenger.sendResponse(deepEqual(genericResponse))).once();
  });
});

describe('Inject context on receive', () => {
  it('Should inject context on receive', async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };

    when(messenger.receiveRequest(anything())).thenResolve({
      senderID,
      newContext: expectedContext,
      visualContents: []
    });

    when(contextDAO.getContext(senderID)).thenResolve(expectedContext);

    const transformed = compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO))
    );

    const genericRequest: GenericRequest<Context> = {
      senderID,
      senderPlatform,
      oldContext: {},
      data: []
    };

    // When
    await transformed.receiveRequest(genericRequest);

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

    when(messenger.receiveRequest(anything())).thenResolve({
      senderID,
      visualContents: []
    });

    when(communicator.getUser(senderID)).thenResolve(chatbotUser);

    const transformed = compose(
      instance(messenger),
      saveUserForSenderID(
        instance(communicator),
        async () => chatbotUser,
        ({ id }) => id
      )
    );

    const genericRequest: GenericRequest<
      Context & Pick<DefaultContext, 'senderID'>
    > = {
      senderID,
      senderPlatform,
      oldContext: { senderID: '' },
      data: []
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(communicator.getUser(senderID)).once();

    verify(
      messenger.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: { senderID } })
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

    const transformed = compose(
      instance(messenger),
      setTypingIndicator(instance(communicator))
    );

    // When
    await transformed.receiveRequest({
      senderID,
      senderPlatform,
      oldContext: {},
      data: []
    });

    await transformed.sendResponse({
      senderID,
      senderPlatform,
      visualContents: []
    });

    // Then
    verify(communicator.setTypingIndicator(senderID, true)).calledBefore(
      communicator.setTypingIndicator(senderID, false)
    );
  });
});
