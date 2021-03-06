import { ContextDAO } from "../type/context-dao";
import {
  MessageProcessorMiddleware,
  SaveUserForTargetIDContext,
  SetTypingIndicatorConfig,
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
        const { targetID, targetPlatform, additionalContext } = response;

        const [result] = await Promise.all([
          processor.sendResponse(response),
          (async function () {
            if (additionalContext == null) return;

            const { newContext, oldContext } = await contextDAO.appendContext({
              targetID,
              targetPlatform,
              context: additionalContext,
            });

            const finalProcessor = getFinalMessageProcessor();

            await finalProcessor.receiveRequest({
              currentContext: newContext,
              input: {
                newContext,
                oldContext,
                changedContext: additionalContext,
                type: "context_change",
              },
              targetID: response.targetID,
              targetPlatform: response.targetPlatform,
              type: "manual_trigger",
            });
          })(),
        ]);

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
        if (request.input.type === "context_change") {
          return processor.receiveRequest(request);
        }

        const { targetID, targetPlatform } = request;

        let currentContext = await contextDAO.getContext({
          targetID,
          targetPlatform,
        });

        /** Allow the request's context to override stored context */
        currentContext = { ...currentContext, ...request.currentContext };
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
        if (request.input.type === "context_change") {
          return processor.receiveRequest(request);
        }

        let { currentContext, targetID, targetPlatform } = request;

        if (!currentContext || !(currentContext as any)["targetID"]) {
          const rawUser = await getUser(targetID);

          const {
            additionalContext = {} as Partial<Context>,
            targetUserID,
          } = await saveUser(rawUser);

          const { newContext } = await contextDAO.appendContext({
            targetID,
            targetPlatform,
            context: { ...additionalContext, targetID: `${targetUserID}` },
          });

          currentContext = newContext;
        }

        return processor.receiveRequest({ ...request, currentContext });
      },
    };
  };
}

/**
 * Set typing indicator on or off at the beginning and end of the messaging
 * process. We can choose to ignore set typing errors since they are not so
 * important.
 */
export function setTypingIndicator<Context>({
  client,
  onSetTypingError = (error) => {
    throw error;
  },
}: SetTypingIndicatorConfig): MessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const { targetID } = response;

        const [result] = await Promise.all([
          processor.sendResponse(response),
          (async function () {
            try {
              await client.setTypingIndicator(targetID, true);
            } catch (error) {
              onSetTypingError(error);
            }
          })(),
        ]);

        try {
          await client.setTypingIndicator(targetID, false);
        } catch (error) {
          onSetTypingError(error);
        }

        return result;
      },
    };
  };
}
