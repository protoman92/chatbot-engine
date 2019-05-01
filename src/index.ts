export * from './content/higher-order';
export { createLeafWithObserver } from './content/leaf';
export { createLeafSelector, ERROR_LEAF_ID } from './content/leaf-selector';
export { createInMemoryContextDAO } from './context/InMemoryContextDAO';
export { createRedisContextDAO } from './context/RedisContextDAO';
export * from './messenger/axios-communicator';
export * from './messenger/facebook-communicator';
export { createFacebookMessenger } from './messenger/facebook-messenger';
export * from './messenger/generic-messenger';
export { saveUserForSenderID } from './messenger/unit-compose';
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
export * from './type/leaf-selector';
export { LeafCombinationTesterParam } from './type/leaf-selector-tester';
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
} from './messenger/unit-compose';
import { ComposeFunc } from './type/common';
import { PlatformCommunicator } from './type/communicator';
import { ContextDAO } from './type/context-dao';
import { FacebookConfigs } from './type/facebook';
import { LeafSelector } from './type/leaf-selector';
import { UnitMessenger } from './type/messenger';

/**
 * Force some default compose functions on the base unit messenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param contextDAO A context DAO instance.
 * @param communicator A platform communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export function createFacebookUnitMessenger<C>(
  leafSelector: LeafSelector<C>,
  contextDAO: ContextDAO<C>,
  communicator: PlatformCommunicator,
  configuration: FacebookConfigs,
  ...composeFuncs: ComposeFunc<UnitMessenger<C>>[]
) {
  return _createFacebookUnitMessenger(
    leafSelector,
    communicator,
    configuration,
    injectContextOnReceive(contextDAO),
    saveContextOnSend(contextDAO),
    setTypingIndicator(communicator),
    ...composeFuncs
  );
}
