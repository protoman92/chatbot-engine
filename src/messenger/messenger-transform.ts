import { PlatformClient } from "../type/client";
import { ContextDAO } from "../type/context-dao";
import {
  MessageProcessorMiddleware,
  SaveUserForTargetIDContext,
} from "../type/messenger";

/**
 * Save the context every time a message group is sent to a target ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 */
export function saveContextOnSend<Context>(
  contextDAO: Pick<ContextDAO<Context>, "getContext" | "appendContext">
): MessageProcessorMiddleware<Context> {
  return ({ getFinalMessageProcessor }) => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const {
          targetID,
          targetPlatform,
          additionalContext,
          originalRequest,
        } = response;

        const result = await processor.sendResponse(response);

        if (additionalContext != null) {
          const { newContext, oldContext } = await contextDAO.appendContext({
            targetID,
            targetPlatform,
            context: additionalContext,
          });

          const finalProcessor = getFinalMessageProcessor();

          await finalProcessor.receiveRequest({
            newContext,
            oldContext,
            changedContext: additionalContext,
            currentContext: originalRequest.currentContext,
            input: { type: "placebo" },
            targetID: originalRequest.targetID,
            targetPlatform: originalRequest.targetPlatform,
            type: "context_trigger",
          });
        }

        return result;
      },
    };
  };
}

/**
 * Inject the relevant context for a target every time a message group is
 * processed.
 */
export function injectContextOnReceive<Context>(
  contextDAO: Pick<ContextDAO<Context>, "getContext">
): MessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        if (request.type === "context_trigger") {
          return processor.receiveRequest(request);
        }

        const { targetID, targetPlatform } = request;

        let currentContext = await contextDAO.getContext({
          targetID,
          targetPlatform,
        });

        currentContext = { ...request.currentContext, ...currentContext };
        return processor.receiveRequest({ ...request, currentContext });
      },
    };
  };
}

/**
 * Save user in backend if there is no target ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 */
export function saveUserForTargetID<Context, RawUser>(
  contextDAO: ContextDAO<Context>,
  getUser: (targetID: string) => Promise<RawUser>,
  saveUser: (rawUser: RawUser) => Promise<SaveUserForTargetIDContext<Context>>
): MessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        if (request.type === "context_trigger") {
          return processor.receiveRequest(request);
        }

        const { currentContext, targetID, targetPlatform } = request;

        if (!currentContext || !(currentContext as any)["targetID"]) {
          const rawUser = await getUser(targetID);

          const {
            additionalContext = {} as Partial<Context>,
            targetUserID,
          } = await saveUser(rawUser);

          await contextDAO.appendContext({
            targetID,
            targetPlatform,
            context: { ...additionalContext, targetID: `${targetUserID}` },
          });
        }

        return processor.receiveRequest({ ...request, currentContext });
      },
    };
  };
}

/**
 * Set typing indicator on or off at the beginning and end of the messaging
 * process.
 */
export function setTypingIndicator<Context>(
  client: PlatformClient<unknown>
): MessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const { targetID } = response;
        await client.setTypingIndicator(targetID, true);
        const result = await processor.sendResponse(response);
        await client.setTypingIndicator(targetID, false);
        return result;
      },
    };
  };
}
