import { Transformer } from '../type/common';
import { HTTPCommunicator } from '../type/communicator';
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
import { createTelegramCommunicator } from './telegram-communicator';

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
  ...transformers: readonly Transformer<UnitMessenger<C>>[]
): Promise<TelegramUnitMessenger<C>> {
  const unitMessenger = await createGenericUnitMessenger(
    leafSelector,
    communicator,
    async () => [],
    ...transformers
  );

  return unitMessenger;
}

/**
 * Create a Telegram mesenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A platform communicator instance.
 * @param configs Telegram configurations.
 * @return A generic messenger.
 */
export async function createTelegramMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: HTTPCommunicator,
  configs: TelegramConfigs,
  ...transformers: readonly Transformer<UnitMessenger<C>>[]
): Promise<Messenger<TelegramRequest, TelegramResponse>> {
  const tlCommunicator = createTelegramCommunicator(communicator, configs);

  const unitMessenger = await createTelegramUnitMessenger(
    leafSelector,
    tlCommunicator,
    ...transformers
  );

  return createGenericMessenger(unitMessenger, async () => []);
}
