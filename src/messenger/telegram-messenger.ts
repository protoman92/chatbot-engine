import { Transformer } from '../type/common';
import { Leaf } from '../type/leaf';
import { Messenger, UnitMessenger } from '../type/messenger';
import {
  TelegramCommunicator,
  TelegramConfigs,
  TelegramRequest,
  TelegramResponse,
  TelegramUnitMessenger
} from '../type/telegram';
import {
  createGenericMessenger,
  createGenericUnitMessenger
} from './generic-messenger';

/**
 * Create a unit Telegram messenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A platform communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export async function createTelegramUnitMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: TelegramCommunicator,
  configurations: TelegramConfigs,
  ...transformers: readonly Transformer<UnitMessenger<C>>[]
): Promise<TelegramUnitMessenger<C>> {
  const unitMessenger = await createGenericUnitMessenger(
    leafSelector,
    communicator,
    async () => [],
    ...transformers
  );

  return {
    ...unitMessenger
  };
}

/**
 * Create a Telegram mesenger.
 * @template C The context used by the current chatbot.
 * @param unitMessenger A Telegram unit messenger.
 * @return A generic messenger.
 */
export function createTelegramMessenger<C>(
  unitMessenger: TelegramUnitMessenger<C>
): Messenger<TelegramRequest, TelegramResponse> {
  return createGenericMessenger(unitMessenger, async () => []);
}
