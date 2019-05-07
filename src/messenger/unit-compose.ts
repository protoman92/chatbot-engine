import { deepClone, joinObjects } from '../common/utils';
import { ComposeFunc, DefaultContext } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import { UnitMessenger } from '../type/messenger';

/**
 * Save the context every time a message group is sent to a sender ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 * @template C The context used by the current chatbot.
 * @param contextDAO The context DAO being used to perform CRUD.
 * @return A compose function.
 */
export function saveContextOnSend<C>(
  contextDAO: Pick<ContextDAO<C>, 'getContext' | 'setContext'>
): ComposeFunc<UnitMessenger<C>> {
  return function saveContextOnSend(unitMessenger) {
    return {
      ...unitMessenger,
      sendResponse: async response => {
        const { senderID, additionalContext } = response;
        const result = await unitMessenger.sendResponse(response);

        if (!!additionalContext) {
          const oldContext = await contextDAO.getContext(senderID);
          const newContext = joinObjects(oldContext, additionalContext);
          await contextDAO.setContext(senderID, newContext);
        }

        return result;
      }
    };
  };
}

/**
 * Inject the relevant context for a sender every time a message group is
 * processed.
 * @template C The context used by the current chatbot.
 * @param contextDAO The context DAO being used to perform CRUD.
 * @return A compose function.
 */
export function injectContextOnReceive<C>(
  contextDAO: Pick<ContextDAO<C>, 'getContext'>
): ComposeFunc<UnitMessenger<C>> {
  return function injectContextOnReceive(unitMessenger) {
    return {
      ...unitMessenger,
      receiveRequest: async request => {
        let oldContext = await contextDAO.getContext(request.senderID);
        oldContext = deepClone({ ...request.oldContext, ...oldContext });
        return unitMessenger.receiveRequest({ ...request, oldContext });
      }
    };
  };
}

/**
 * Save user in backend if there is no sender ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 * @template C The context used by the current chatbot.
 * @template PUser The platform user type.
 * @template CUser The chatbot's user type.
 * @param communicator A platform communicator instance.
 * @param saveUser Function to save platform user to some database.
 * @param getUserID Function to get user ID from the related chatbot user.
 * @return A compose function.
 */
export function saveUserForSenderID<C, PUser, CUser>(
  communicator: PlatformCommunicator,
  saveUser: (platformUser: PUser) => Promise<CUser>,
  getUserID: (chatbotUser: CUser) => unknown
): ComposeFunc<UnitMessenger<C & Pick<DefaultContext, 'senderID'>>> {
  return function saveUserForSenderID(unitMessenger) {
    return {
      ...unitMessenger,
      receiveRequest: async request => {
        let { oldContext } = request;
        const { senderID } = request;

        if (!oldContext || !oldContext.senderID) {
          const platformUser = await communicator.getUser<PUser>(senderID);
          const newUser = await saveUser(platformUser);
          const sidKey: keyof DefaultContext = 'senderID';
          const userID = getUserID(newUser);

          oldContext = deepClone(
            Object.assign(oldContext, { [sidKey]: userID })
          );
        }

        return unitMessenger.receiveRequest({ ...request, oldContext });
      }
    };
  };
}

/**
 * Set typing indicator on or off at the beginning and end of the messaging
 * process.
 * @template C The context used by the current chatbot.
 * @param communicator A platform communicator instance.
 * @return A compose function.
 */
export function setTypingIndicator<C>(
  communicator: PlatformCommunicator
): ComposeFunc<UnitMessenger<C>> {
  return function setTypingIndicator(unitMessenger) {
    return {
      ...unitMessenger,
      receiveRequest: async request => {
        const { senderID } = request;
        await communicator.setTypingIndicator(senderID, true);
        return unitMessenger.receiveRequest(request);
      },
      sendResponse: async response => {
        const result = await unitMessenger.sendResponse(response);
        const { senderID } = response;
        await communicator.setTypingIndicator(senderID, false);
        return result;
      }
    };
  };
}
