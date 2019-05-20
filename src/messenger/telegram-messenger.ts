import { Transformer } from '../type/common';
import { Leaf } from '../type/leaf';
import { BatchMessenger, Messenger } from '../type/messenger';
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
    async () => [],
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
  return createBatchMessenger(messenger, async () => []);
}
