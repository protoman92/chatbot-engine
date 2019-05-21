import { Omit } from 'ts-essentials';
import {
  DEFAULT_COORDINATES,
  formatTelegramError,
  isType
} from '../common/utils';
import { Transformer } from '../type/common';
import { Leaf } from '../type/leaf';
import { BatchMessenger, Messenger } from '../type/messenger';
import { GenericRequest } from '../type/request';
import {
  TelegramCommunicator,
  TelegramMessenger,
  TelegramRequest,
  TelegramResponse
} from '../type/telegram';
import {
  createBatchMessenger,
  createGenericMessenger
} from './generic-messenger';

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 */
function createGenericRequest<C>(
  webhook: TelegramRequest,
  senderPlatform: 'telegram'
): readonly GenericRequest<C>[] {
  const {
    message: {
      chat: { id }
    }
  } = webhook;

  function processRequest(
    request: Omit<TelegramRequest, keyof TelegramRequest.Base>
  ): GenericRequest.Telegram<C>['data'] {
    if (isType<TelegramRequest.Text>(webhook, 'text')) {
      return [
        {
          senderPlatform,
          inputText: request.text,
          inputImageURL: '',
          inputCoordinate: DEFAULT_COORDINATES
        }
      ];
    }

    throw Error(
      formatTelegramError(`Invalid request ${JSON.stringify(request)}`)
    );
  }

  return [
    {
      senderID: `${id}`,
      senderPlatform: 'telegram',
      oldContext: {} as C,
      data: processRequest(webhook)
    }
  ];
}

/**
 * Create a Telegram messenger.
 * @template C The context used by the current chatbot.
 */
export async function createTelegramMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: TelegramCommunicator,
  ...transformers: readonly Transformer<Messenger<C>>[]
): Promise<TelegramMessenger<C>> {
  await communicator.setWebhook();

  const messenger = await createGenericMessenger(
    leafSelector,
    communicator,
    async response => [],
    ...transformers
  );

  return messenger;
}

/**
 * Create a Telegram mesenger.
 * @template C The context used by the current chatbot.
 */
export function createTelegramBatchMessenger<C>(
  messenger: Messenger<C>
): BatchMessenger<TelegramRequest, TelegramResponse> {
  return createBatchMessenger(messenger, async request =>
    createGenericRequest(request, 'telegram')
  );
}
