import { deepClone } from '../common/utils';
import { ComposeFunc, Context, DefaultContext } from '../type/common';
import { ServiceCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import { UnitMessenger } from '../type/messenger';

/**
 * Save the context every time a message group is sent to a sender ID.
 * @template C The shape of the context used by the current chatbot.
 * @param contextDAO The context DAO being used to perform CRUD.
 * @return A compose function.
 */
export function saveContextOnSend<C extends Context>(
  contextDAO: Pick<ContextDAO<C>, 'setContext'>
): ComposeFunc<UnitMessenger<C>> {
  return unitMessenger => ({
    ...unitMessenger,
    sendPlatformResponse: async response => {
      const { senderID, newContext } = response;
      const result = await unitMessenger.sendPlatformResponse(response);
      const cacheKey = unitMessenger.getContextDAOCacheKey(senderID);
      await contextDAO.setContext(cacheKey, newContext);
      return result;
    }
  });
}

/**
 * Inject the relevant context for a sender every time a message group is
 * processed.
 * @template C The shape of the context used by the current chatbot.
 * @param contextDAO The context DAO being used to perform CRUD.
 * @return A compose function.
 */
export function injectContextOnReceive<C extends Context>(
  contextDAO: Pick<ContextDAO<C>, 'getContext'>
): ComposeFunc<UnitMessenger<C>> {
  return handler => ({
    ...handler,
    mapGenericRequest: async request => {
      const cacheKey = handler.getContextDAOCacheKey(request.senderID);
      let oldContext = await contextDAO.getContext(cacheKey);
      oldContext = deepClone({ ...request.oldContext, ...oldContext });
      return handler.mapGenericRequest({ ...request, oldContext });
    }
  });
}

/**
 * Save user in backend if there is no sender ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 * @template C The shape of the context used by the current chatbot.
 * @template PUser The platform user type.
 * @template CUser The chatbot's user type.
 * @param communicator A service communicator instance.
 * @param saveUser Function to save platform user to some database.
 * @param getUserID Function to get user ID from the related chatbot user.
 * @return A compose function.
 */
export function saveUserForSenderID<C extends DefaultContext, PUser, CUser>(
  communicator: ServiceCommunicator,
  saveUser: (platformUser: PUser) => PromiseLike<CUser>,
  getUserID: (chatbotUser: CUser) => unknown
): ComposeFunc<UnitMessenger<C>> {
  return unitMessenger => ({
    ...unitMessenger,
    mapGenericRequest: async request => {
      let { oldContext } = request;
      const { senderID } = request;

      if (!oldContext || !oldContext.senderID) {
        const platformUser = await communicator.getUser<PUser>(senderID);
        const newUser = await saveUser(platformUser);
        const sidKey: keyof DefaultContext = 'senderID';
        const userID = getUserID(newUser);
        oldContext = deepClone(Object.assign(oldContext, { [sidKey]: userID }));
      }

      return unitMessenger.mapGenericRequest({ ...request, oldContext });
    }
  });
}

/**
 * Set typing indicator on or off at the beginning and end of the messaging
 * process.
 * @template C The shape of the context used by the current chatbot.
 * @param communicator A service communicator instance.
 * @return A compose function.
 */
export function setTypingIndicator<C extends Context>(
  communicator: ServiceCommunicator
): ComposeFunc<UnitMessenger<C>> {
  return unitMessenger => ({
    ...unitMessenger,
    mapGenericRequest: async request => {
      const { senderID } = request;
      await communicator.setTypingIndicator(senderID, true);
      return unitMessenger.mapGenericRequest(request);
    },
    sendPlatformResponse: async response => {
      const result = await unitMessenger.sendPlatformResponse(response);
      const { senderID } = response;
      await communicator.setTypingIndicator(senderID, false);
      return result;
    }
  });
}
