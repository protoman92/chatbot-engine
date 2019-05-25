import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { Telegram } from '../../src';
import { compose, joinObjects } from '../../src/common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForTargetID,
  setTypingIndicator
} from '../../src/messenger/messenger-transform';
import { saveTelegramUser } from '../../src/messenger/telegram-transform';
import { PlatformCommunicator } from '../../src/type/communicator';
import { ContextDAO } from '../../src/type/context-dao';
import { Messenger } from '../../src/type/messenger';
import { GenericRequest } from '../../src/type/request';
import { GenericResponse } from '../../src/type/response';

const targetID = 'target-id';
const targetPlatform = 'facebook';
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
    when(contextDAO.getContext(targetID)).thenResolve(oldContext);
    when(contextDAO.setContext(targetID, anything())).thenResolve();
    when(messenger.sendResponse(anything())).thenResolve();

    const transformed = compose(
      instance(messenger),
      saveContextOnSend(instance(contextDAO))
    );

    const additionalContext: Partial<{}> = { a: 1, b: 2 };

    const genericResponse: GenericResponse<{}> = {
      targetID,
      targetPlatform,
      additionalContext,
      visualContents: []
    };

    // When
    await transformed.sendResponse(genericResponse);

    // Then
    const newContext = joinObjects(oldContext, additionalContext);
    verify(contextDAO.getContext(targetID)).once();
    verify(contextDAO.setContext(targetID, deepEqual(newContext))).once();
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

    const transformed = compose(
      instance(messenger),
      injectContextOnReceive(instance(contextDAO))
    );

    const genericRequest: GenericRequest<{}> = {
      targetID,
      targetPlatform,
      oldContext: {},
      data: []
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
    when(contextDAO.setContext(anything(), anything())).thenResolve({});

    when(messenger.receiveRequest(anything())).thenResolve({
      targetID,
      visualContents: []
    });

    const transformed = compose(
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
      data: []
    };

    // When
    await transformed.receiveRequest(genericRequest);

    // Then
    verify(contextDAO.setContext(targetID, deepEqual({ targetID }))).once();

    verify(
      messenger.receiveRequest(
        deepEqual({ ...genericRequest, oldContext: { targetID } })
      )
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
    const id = 1000;
    const targetID = `${id}`;

    const genericReqs: readonly Telegram.GenericRequest<{}>[] = [
      { targetID, targetPlatform: 'telegram', oldContext: {}, data: [] },
      { targetID, targetPlatform: 'telegram', oldContext: {}, data: [] }
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
    verify(contextDAO.setContext(targetID, deepEqual({ targetID }))).once();

    actualGenericReqs.forEach(({ oldContext }) => {
      expectJs(oldContext).to.eql({ targetID });
    });
  });
});

describe('Set typing indicator', () => {
  it('Should set typing indicator when response is being sent', async () => {
    // Setup
    when(messenger.sendResponse(anything())).thenResolve();
    when(communicator.setTypingIndicator(targetID, anything())).thenResolve();

    const transformed = compose(
      instance(messenger),
      setTypingIndicator(instance(communicator))
    );

    // When
    await transformed.sendResponse({
      targetID,
      targetPlatform,
      visualContents: []
    });

    // Then
    verify(communicator.setTypingIndicator(targetID, true)).calledBefore(
      communicator.setTypingIndicator(targetID, false)
    );
  });
});
