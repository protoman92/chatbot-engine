import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { Telegram } from '..';
import { compose } from '../common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForTargetID,
  setTypingIndicator
} from './messenger-transform';
import { saveTelegramUser } from './telegram-transform';
import { PlatformCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import { Messenger } from '../type/messenger';
import { GenericRequest } from '../type/request';
import { GenericResponse } from '../type/response';

const targetID = 'target-id';
const targetPlatform = 'facebook';
let messenger: Messenger<{}, unknown, GenericRequest<{}>>;
let communicator: PlatformCommunicator<unknown>;
let contextDAO: ContextDAO<{}>;

beforeEach(async () => {
  messenger = spy<Messenger<{}, unknown, GenericRequest<{}>>>({
    generalizeRequest: () => Promise.reject(''),
    receiveRequest: () => Promise.reject(''),
    sendResponse: () => Promise.reject('')
  });

  communicator = spy<PlatformCommunicator<unknown>>({
    sendResponse: () => Promise.reject(''),
    setTypingIndicator: () => Promise.reject('')
  });

  contextDAO = spy<ContextDAO<{}>>({
    getContext: () => Promise.reject(''),
    appendContext: () => Promise.reject(''),
    resetContext: () => Promise.reject('')
  });
});

describe('Save context on send', () => {
  it('Should save context on send', async () => {
    // Setup
    const oldContext: {} = { a: 1, b: 2 };
    when(contextDAO.getContext(targetID)).thenResolve(oldContext);
    when(contextDAO.appendContext(targetID, anything())).thenResolve();
    when(messenger.sendResponse(anything())).thenResolve();

    const transformed = await compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const additionalContext: Partial<{}> = { a: 1, b: 2 };

    const genericResponse: GenericResponse<{}> = {
      targetID,
      targetPlatform,
      additionalContext,
      output: []
    };

    // When
    await transformed.sendResponse(genericResponse);

    // Then
    verify(
      contextDAO.appendContext(targetID, deepEqual(additionalContext))
    ).once();

    verify(messenger.sendResponse(deepEqual(genericResponse))).once();
  });
});

describe('Inject context on receive', () => {
  it('Should inject context on receive', async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };

    when(messenger.receiveRequest(anything())).thenResolve({
      targetID,
      newContext: expectedContext,
      visualContents: []
    });

    when(contextDAO.getContext(targetID)).thenResolve(expectedContext);

    const transformed = await compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO))
    );

    const genericRequest: GenericRequest<{}> = {
      targetID,
      targetPlatform,
      oldContext: {},
      input: []
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(contextDAO.getContext(targetID)).once();

    verify(
      messenger.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: expectedContext })
      )
    ).once();
  });
});

describe('Save user for target ID', () => {
  it('Should save user when no user ID is present in context', async () => {
    // Setup
    when(contextDAO.appendContext(anything(), anything())).thenResolve({});

    when(messenger.receiveRequest(anything())).thenResolve({
      targetID,
      visualContents: []
    });

    const transformed = await compose(
      instance(messenger),
      saveUserForTargetID(
        instance(contextDAO),
        async () => ({ id: targetID }),
        async () => {}
      )
    );

    const genericRequest: GenericRequest<{}> = {
      targetID,
      targetPlatform,
      oldContext: {},
      input: []
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(contextDAO.appendContext(targetID, deepEqual({ targetID }))).once();

    verify(
      messenger.receiveRequest(deepEqual({ ...genericRequest, oldContext: {} }))
    ).once();
  });
});

describe('Save Telegram user for target ID', () => {
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
    when(contextDAO.appendContext(anything(), anything())).thenResolve({});
    when(tlMessenger.receiveRequest(anything())).thenResolve({});

    const transformed = await compose(
      instance(tlMessenger),
      saveTelegramUser(instance(contextDAO), () => Promise.resolve({}))
    );

    // When
    await transformed.receiveRequest({
      targetID,
      telegramUser: {
        id: 0,
        first_name: '',
        last_name: '',
        username: '',
        language_code: 'en' as const,
        is_bot: false
      },
      targetPlatform: 'telegram',
      oldContext: {},
      input: []
    });

    // Then
    verify(contextDAO.appendContext(targetID, deepEqual({ targetID }))).once();
  });
});

describe('Set typing indicator', () => {
  it('Should set typing indicator when response is being sent', async () => {
    // Setup
    when(messenger.sendResponse(anything())).thenResolve();
    when(communicator.setTypingIndicator(targetID, anything())).thenResolve();

    const transformed = await compose(
      instance(messenger),
      setTypingIndicator(instance(communicator))
    );

    // When
    await transformed.sendResponse({
      targetID,
      targetPlatform,
      output: []
    });

    // Then
    verify(communicator.setTypingIndicator(targetID, true)).calledBefore(
      communicator.setTypingIndicator(targetID, false)
    );
  });
});
