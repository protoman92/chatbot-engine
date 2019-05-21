import { compose, deepClone, joinObjects } from '../common/utils';
import { DefaultContext, Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import { Messenger } from '../type/messenger';

/**
 * Save the context every time a message group is sent to a sender ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 */
export function saveContextOnSend<C, PLRequest>(
  contextDAO: Pick<ContextDAO<C>, 'getContext' | 'setContext'>
): Transformer<Messenger<C, PLRequest>> {
  return function saveContextOnSend(messenger) {
    return {
      ...messenger,
      sendResponse: async response => {
        const { senderID, additionalContext } = response;
        const result = await messenger.sendResponse(response);

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
 * @template PLRequest The platform-specific request.*
 */
export function injectContextOnReceive<C, PLRequest>(
  contextDAO: Pick<ContextDAO<C>, 'getContext'>
): Transformer<Messenger<C, PLRequest>> {
  return function injectContextOnReceive(messenger) {
    return {
      ...messenger,
      receiveRequest: async request => {
        let oldContext = await contextDAO.getContext(request.senderID);
        oldContext = deepClone({ ...request.oldContext, ...oldContext });
        return messenger.receiveRequest({ ...request, oldContext });
      }
    };
  };
}

/**
 * Save user in backend if there is no sender ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 * @template PUser The platform user type.
 * @template CUser The chatbot's user type.
 */
export function saveUserForSenderID<C, PLRequest, PLResponse, PUser>(
  communicator: PlatformCommunicator<PLResponse>,
  saveUser: (platformUser: PUser) => Promise<unknown>
): Transformer<Messenger<C, PLRequest>> {
  return function saveUserForSenderID(messenger) {
    return {
      ...messenger,
      receiveRequest: async request => {
        let { oldContext } = request;
        const { senderID } = request;
        const sidKey: keyof DefaultContext = 'senderID';

        if (!oldContext || !(oldContext as any)[sidKey]) {
          const platformUser = await communicator.getUser<PUser>(senderID);
          await saveUser(platformUser);

          oldContext = deepClone(
            Object.assign(oldContext, { [sidKey]: senderID })
          );
        }

        return messenger.receiveRequest({ ...request, oldContext });
      }
    };
  };
}

/**
 * Set typing indicator on or off at the beginning and end of the messaging
 * process.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 */
export function setTypingIndicator<C, PLRequest, PLResponse>(
  communicator: PlatformCommunicator<PLResponse>
): Transformer<Messenger<C, PLRequest>> {
  return function setTypingIndicator(messenger) {
    return {
      ...messenger,
      receiveRequest: async request => {
        const { senderID } = request;
        await communicator.setTypingIndicator(senderID, true);
        return messenger.receiveRequest(request);
      },
      sendResponse: async response => {
        const result = await messenger.sendResponse(response);
        const { senderID } = response;
        await communicator.setTypingIndicator(senderID, false);
        return result;
      }
    };
  };
}

/**
 * Create default messenger transformers that all messengers should use.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 */
export function transformMessengersByDefault<C, PLRequest, PLResponse>(
  contextDAO: Pick<ContextDAO<C>, 'getContext' | 'setContext'>,
  communicator: PlatformCommunicator<PLResponse>
): Transformer<Messenger<C, PLRequest>> {
  return messenger =>
    compose(
      messenger,
      injectContextOnReceive(contextDAO),
      saveContextOnSend(contextDAO),
      setTypingIndicator(communicator)
    );
}
