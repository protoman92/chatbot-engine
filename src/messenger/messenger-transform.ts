import { compose, deepClone } from '../common/utils';
import { DefaultContext, Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import { Messenger } from '../type/messenger';
import { GenericRequest } from '../type/request';

/**
 * Save the context every time a message group is sent to a target ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template GRequest The platform-specific generic request.
 */
export function saveContextOnSend<
  C,
  PLRequest,
  GRequest extends GenericRequest<C>
>(
  contextDAO: Pick<ContextDAO<C>, 'getContext' | 'appendContext'>
): Transformer<Messenger<C, PLRequest, GRequest>> {
  return async messenger => {
    return {
      ...messenger,
      sendResponse: async response => {
        const { targetID, additionalContext } = response;
        const result = await messenger.sendResponse(response);

        if (!!additionalContext) {
          await contextDAO.appendContext(targetID, additionalContext);
        }

        return result;
      }
    };
  };
}

/**
 * Inject the relevant context for a target every time a message group is
 * processed.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template GRequest The platform-specific generic request.
 */
export function injectContextOnReceive<
  C,
  PLRequest,
  GRequest extends GenericRequest<C>
>(
  contextDAO: Pick<ContextDAO<C>, 'getContext'>
): Transformer<Messenger<C, PLRequest, GRequest>> {
  return async messenger => {
    return {
      ...messenger,
      receiveRequest: async request => {
        let oldContext = await contextDAO.getContext(request.targetID);
        oldContext = deepClone({ ...request.oldContext, ...oldContext });
        return messenger.receiveRequest({ ...request, oldContext });
      }
    };
  };
}

/**
 * Save user in backend if there is no target ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template GRequest The platform-specific generic request.
 * @template PUser The platform user type.
 */
export function saveUserForTargetID<
  C,
  PLRequest,
  GRequest extends GenericRequest<C>,
  PUser
>(
  contextDAO: ContextDAO<C>,
  getUser: (targetID: string) => Promise<PUser>,
  saveUser: (platformUser: PUser) => Promise<unknown>
): Transformer<Messenger<C, PLRequest, GRequest>> {
  return async messenger => {
    return {
      ...messenger,
      receiveRequest: async request => {
        const { oldContext, targetID } = request;
        const sidKey: keyof DefaultContext = 'targetID';

        if (!oldContext || !(oldContext as any)[sidKey]) {
          const platformUser = await getUser(targetID);
          await saveUser(platformUser);
          const additionalContext: {} = { [sidKey]: targetID };
          await contextDAO.appendContext(targetID, additionalContext);
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
 * @template GRequest The platform-specific generic request.
 */
export function setTypingIndicator<
  C,
  PLRequest,
  PLResponse,
  GRequest extends GenericRequest<C>
>(
  communicator: PlatformCommunicator<PLResponse>
): Transformer<Messenger<C, PLRequest, GRequest>> {
  return async messenger => {
    return {
      ...messenger,
      sendResponse: async response => {
        const { targetID } = response;
        await communicator.setTypingIndicator(targetID, true);
        const result = await messenger.sendResponse(response);
        await communicator.setTypingIndicator(targetID, false);
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
 * @template GRequest The platform-specific generic request.
 */
export function transformMessengersByDefault<
  C,
  PLRequest,
  PLResponse,
  GRequest extends GenericRequest<C>
>(
  contextDAO: Pick<ContextDAO<C>, 'getContext' | 'appendContext'>,
  communicator: PlatformCommunicator<PLResponse>
): Transformer<Messenger<C, PLRequest, GRequest>> {
  return messenger =>
    compose(
      messenger,
      injectContextOnReceive(contextDAO),
      saveContextOnSend(contextDAO),
      setTypingIndicator(communicator)
    );
}
