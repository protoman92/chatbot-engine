export * from './content/higher-order';
export { createLeafWithObserver } from './content/leaf';
export { createLeafSelector, ERROR_LEAF_ID } from './content/leaf-selector';
export { createInMemoryContextDAO } from './context/InMemoryContextDAO';
export { createRedisContextDAO } from './context/RedisContextDAO';
export * from './messenger/axios-communicator';
export * from './messenger/facebook-communicator';
export { createFacebookMessenger } from './messenger/facebook-messenger';
export * from './messenger/generic-messenger';
export { saveUserForSenderID } from './messenger/unit-transform';
export {
  bridgeEmission,
  createContentSubject,
  STREAM_INVALID_NEXT_RESULT as INVALID_NEXT_RESULT
} from './stream/stream';
export * from './type/branch';
export * from './type/common';
export * from './type/communicator';
export * from './type/context-dao';
export * from './type/facebook';
export * from './type/leaf';
export * from './type/messenger';
export * from './type/request';
export * from './type/response';
export * from './type/stream';
export * from './type/visual-content';

import { createFacebookUnitMessenger as _createFacebookUnitMessenger } from './messenger/facebook-messenger';
import {
  injectContextOnReceive,
  saveContextOnSend,
  setTypingIndicator
} from './messenger/unit-transform';
import { Transformer } from './type/common';
import { PlatformCommunicator } from './type/communicator';
import { ContextDAO } from './type/context-dao';
import { FacebookConfigs } from './type/facebook';
import { Leaf } from './type/leaf';
import { UnitMessenger } from './type/messenger';

/**
 * Force some default transform functions on the base unit messenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param contextDAO A context DAO instance.
 * @param communicator A platform communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export function createFacebookUnitMessenger<C>(
  leafSelector: Leaf<C>,
  contextDAO: ContextDAO<C>,
  communicator: PlatformCommunicator,
  configuration: FacebookConfigs,
  ...transformers: Transformer<UnitMessenger<C>>[]
) {
  return _createFacebookUnitMessenger(
    leafSelector,
    communicator,
    configuration,
    injectContextOnReceive(contextDAO),
    saveContextOnSend(contextDAO),
    setTypingIndicator(communicator),
    ...transformers
  );
}
