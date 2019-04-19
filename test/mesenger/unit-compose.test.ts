import { describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito-2';
import { compose } from '../../src/common/utils';
import {
  injectContextOnReceive,
  saveContextOnSend
} from '../../src/messenger/unit-compose';
import { Context } from '../../src/type/common';
import { ContextDAO } from '../../src/type/context-dao';
import {
  GenericRequest,
  UnitMessenger,
  PlatformResponse
} from '../../src/type/messenger';

interface BotContext extends Context {}

const senderID = 'sender-id';
const cacheKey = `cache-${senderID}`;
let messenger: UnitMessenger<BotContext>;
let contextDAO: ContextDAO<BotContext>;

before(async () => {
  messenger = spy({
    getContextDAOCacheKey: () => cacheKey,
    mapGenericRequest: () => Promise.reject(''),
    sendPlatformResponse: () => Promise.reject('')
  });

  contextDAO = spy({
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
    const oldContext: BotContext = { userID: `${senderID}-2` };

    when(messenger.mapGenericRequest(anything())).thenReturn(
      Promise.resolve({
        senderID,
        newContext: oldContext,
        outgoingContents: []
      })
    );

    when(contextDAO.getContext(cacheKey)).thenReturn(
      Promise.resolve(oldContext)
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
      messenger.mapGenericRequest(deepEqual({ ...genericRequest, oldContext }))
    ).once();
  });
});
