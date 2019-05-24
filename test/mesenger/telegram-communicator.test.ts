import expectJs from 'expect.js';
import { beforeEach, describe, it } from 'mocha';
import { anything, instance, spy, when } from 'ts-mockito';
import {
  createTelegramCommunicator,
  HTTPCommunicator,
  Telegram
} from '../../src';

describe('Telegram communicator', () => {
  let communicator: HTTPCommunicator;
  let configs: Telegram.Configs;
  let tlCommunicator: Telegram.Communicator;

  beforeEach(() => {
    communicator = spy<HTTPCommunicator>({
      communicate: () => Promise.reject('')
    });

    configs = spy<Telegram.Configs>({ authToken: '', webhookURL: '' });

    tlCommunicator = createTelegramCommunicator(
      instance(communicator),
      instance(configs)
    );
  });

  it('Should return result if ok is true', async () => {
    // Setup
    const result = 10000;

    when(communicator.communicate(anything())).thenResolve({
      result,
      description: 'some-description',
      ok: true
    });

    // When
    const apiResponse = await tlCommunicator.sendResponse({
      action: 'sendMessage',
      chat_id: '',
      text: 'Hey',
      reply_markup: undefined
    });

    // Then
    expectJs(apiResponse).to.eql(result);
  });

  it('Should throw error if ok is false', async () => {
    // Setup
    const description = 'some-error';

    when(communicator.communicate(anything())).thenResolve({
      description,
      ok: false
    });

    try {
      // When
      await tlCommunicator.sendResponse({
        action: 'sendMessage',
        chat_id: '',
        text: 'Hey',
        reply_markup: undefined
      });

      throw new Error('Never should have come here');
    } catch ({ message }) {
      expectJs(message).to.eql(description);
    }
  });
});
