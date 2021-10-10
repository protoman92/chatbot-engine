import {
  AmbiguousRequest,
  ContextDAO,
  MessageProcessorMiddleware,
  PlatformClient,
} from "../type";

/**
 * Save the context every time a message group is sent to a target ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 */
export function saveContextOnSend<Context>({
  contextDAO,
}: Readonly<{
  contextDAO: Pick<ContextDAO<Context>, "getContext" | "appendContext">;
}>): MessageProcessorMiddleware<Context> {
  return ({ getFinalMessageProcessor }) => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const {
          originalRequest,
          targetID,
          targetPlatform,
          additionalContext,
        } = response;

        const [result] = await Promise.all([
          processor.sendResponse(response),
          (async function () {
            if (additionalContext == null) return;

            const { newContext, oldContext } = await contextDAO.appendContext({
              additionalContext,
              targetID,
              targetPlatform,
              oldContext: originalRequest?.currentContext,
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
export function injectContextOnReceive<Context>({
  contextDAO,
}: Readonly<{
  contextDAO: Pick<ContextDAO<Context>, "getContext">;
}>): MessageProcessorMiddleware<Context> {
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

export interface SaveUserForTargetIDArgs<Context, RawUser> {
  readonly contextDAO: ContextDAO<Context>;
  getUser(targetID: string): Promise<RawUser>;
  /**
   * If this returns false, do not get user to save. This helps prevent the
   * logic from being called on every request.
   */
  isEnabled(
    args: Pick<AmbiguousRequest<Context>, "currentContext">
  ): Promise<boolean>;
  saveUser(
    rawUser: RawUser
  ): Promise<Readonly<{ additionalContext?: Partial<Context> }>>;
}

/**
 * Save user in backend if there is no target ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 */
export function saveUserForTargetID<Context, RawUser>({
  contextDAO,
  getUser,
  isEnabled,
  saveUser,
}: SaveUserForTargetIDArgs<Context, RawUser>): MessageProcessorMiddleware<
  Context
> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        if (request.input.type === "context_change") {
          return processor.receiveRequest(request);
        }

        let { currentContext, targetID, targetPlatform } = request;

        if (await isEnabled({ currentContext })) {
          const rawUser = await getUser(targetID);
          const { additionalContext = {} } = await saveUser(rawUser);

          const { newContext } = await contextDAO.appendContext({
            additionalContext,
            targetID,
            targetPlatform,
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
}: Readonly<{
  client: PlatformClient<unknown>;
  onSetTypingError?: (e: Error) => void;
}>): MessageProcessorMiddleware<Context> {
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
              onSetTypingError(error as Error);
            }
          })(),
        ]);

        try {
          await client.setTypingIndicator(targetID, false);
        } catch (error) {
          onSetTypingError(error as Error);
        }

        return result;
      },
    };
  };
}
