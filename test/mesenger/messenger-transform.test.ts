import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { Telegram } from '../../src';
import { compose, joinObjects } from '../../src/common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForSenderID,
  setTypingIndicator
} from '../../src/messenger/messenger-transform';
import { saveTelegramUser } from '../../src/messenger/telegram-transform';
import { PlatformCommunicator } from '../../src/type/communicator';
import { ContextDAO } from '../../src/type/context-dao';
import { Messenger } from '../../src/type/messenger';
import { GenericRequest } from '../../src/type/request';
import { GenericResponse } from '../../src/type/response';

const senderID = 'sender-id';
const senderPlatform = 'facebook';
let messenger: Messenger<{}, unknown>;
let communicator: PlatformCommunicator<unknown>;
let contextDAO: ContextDAO<{}>;

beforeEach(async () => {
  messenger = spy<Messenger<{}, unknown>>({
    generalizeRequest: () => Promise.reject(''),
    receiveRequest: () => Promise.reject(''),
    sendResponse: () => Promise.reject('')
  });

  communicator = spy<PlatformCommunicator<unknown>>({
    getUser: () => Promise.reject(''),
    sendResponse: () => Promise.reject(''),
    setTypingIndicator: () => Promise.reject('')
  });

  contextDAO = spy<ContextDAO<{}>>({
    getContext: () => Promise.reject(''),
    setContext: () => Promise.reject(''),
    resetContext: () => Promise.reject('')
  });
});

describe('Save context on send', () => {
  it('Should save context on send', async () => {
    // Setup
    const oldContext: {} = { a: 1, b: 2 };
    when(contextDAO.getContext(senderID)).thenResolve(oldContext);
    when(contextDAO.setContext(senderID, anything())).thenResolve();
    when(messenger.sendResponse(anything())).thenResolve();

    const transformed = compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const additionalContext: Partial<{}> = { a: 1, b: 2 };

    const genericResponse: GenericResponse<{}> = {
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

    const genericRequest: GenericRequest<{}> = {
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
    when(contextDAO.setContext(anything(), anything())).thenResolve({});

    when(messenger.receiveRequest(anything())).thenResolve({
      senderID,
      visualContents: []
    });

    when(communicator.getUser(senderID)).thenResolve(chatbotUser);

    const transformed = compose(
      instance(messenger),
      saveUserForSenderID(
        instance(contextDAO),
        instance(communicator),
        async () => {}
      )
    );

    const genericRequest: GenericRequest<{}> = {
      senderID,
      senderPlatform,
      oldContext: {},
      data: []
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(communicator.getUser(senderID)).once();
    verify(contextDAO.setContext(senderID, deepEqual({ senderID }))).once();

    verify(
      messenger.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: { senderID } })
      )
    ).once();
  });
});

describe('Save Telegram user for sender ID', () => {
  let tlMessenger: Telegram.Messenger<{}>;

  beforeEach(() => {
    tlMessenger = spy<Telegram.Messenger<{}>>({
      generalizeRequest: () => Promise.reject(''),
      receiveRequest: () => Promise.reject(''),
      sendResponse: () => Promise.reject('')
    });
  });

  it('Should save user when no user ID is present in context', async () => {
    // Setup
    const id = 1000;
    const senderID = `${id}`;

    const genericReqs: readonly Telegram.GenericRequest<{}>[] = [
      { senderID, senderPlatform: 'telegram', oldContext: {}, data: [] },
      { senderID, senderPlatform: 'telegram', oldContext: {}, data: [] }
    ];

    when(contextDAO.setContext(anything(), anything())).thenResolve({});
    when(tlMessenger.generalizeRequest(anything())).thenResolve(genericReqs);

    const transformed = compose(
      instance(tlMessenger),
      saveTelegramUser(instance(contextDAO), () => Promise.resolve({}))
    );

    // When
    const actualGenericReqs = await transformed.generalizeRequest({
      update_id: 0,
      message: {
        message_id: 0,
        from: {
          id,
          first_name: '',
          last_name: '',
          username: '',
          language_code: 'en',
          is_bot: false
        },
        chat: {
          id,
          first_name: '',
          last_name: '',
          username: '',
          type: 'private'
        },
        text: ''
      }
    });

    // Then
    verify(contextDAO.setContext(senderID, deepEqual({ senderID }))).once();

    actualGenericReqs.forEach(({ oldContext }) => {
      expectJs(oldContext).to.eql({ senderID });
    });
  });
});

describe('Set typing indicator', () => {
  it('Should set typing indicator when response is being sent', async () => {
    // Setup
    when(messenger.sendResponse(anything())).thenResolve();
    when(communicator.setTypingIndicator(senderID, anything())).thenResolve();

    const transformed = compose(
      instance(messenger),
      setTypingIndicator(instance(communicator))
    );

    // When
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
