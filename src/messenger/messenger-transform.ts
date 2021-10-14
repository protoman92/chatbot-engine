import {
  AmbiguousGenericRequest,
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
      sendResponse: async (genericResponse) => {
        const {
          originalRequest,
          targetID,
          targetPlatform,
          additionalContext,
        } = genericResponse;

        const result = await processor.sendResponse(genericResponse);

        /**
         * We could send the response and emit the context_change request at
         * the same time (which would improve performance), but it might cause
         * issue with message ordering, especially if we have a handler that
         * listens to context changes and sends related messages.
         */
        if (additionalContext != null) {
          const { newContext, oldContext } = await contextDAO.appendContext({
            additionalContext,
            targetID,
            targetPlatform,
            oldContext: originalRequest?.currentContext,
          });

          const finalProcessor = getFinalMessageProcessor();

          await finalProcessor.receiveRequest({
            genericRequest: {
              currentContext: newContext,
              input: {
                newContext,
                oldContext,
                changedContext: additionalContext,
                type: "context_change",
              },
              targetID: genericResponse.targetID,
              targetPlatform: genericResponse.targetPlatform,
              type: "manual_trigger",
            },
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
export function injectContextOnReceive<Context>({
  contextDAO,
}: Readonly<{
  contextDAO: Pick<ContextDAO<Context>, "getContext">;
}>): MessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async ({ genericRequest, ...args }) => {
        if (genericRequest.input.type === "context_change") {
          return processor.receiveRequest({ ...args, genericRequest });
        }

        let currentContext = await contextDAO.getContext({
          targetID: genericRequest.targetID,
          targetPlatform: genericRequest.targetPlatform,
        });

        /** Allow the request's context to override stored context */
        currentContext = {
          ...currentContext,
          ...genericRequest.currentContext,
        };

        return processor.receiveRequest({
          ...args,
          genericRequest: { ...genericRequest, currentContext },
        });
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
    args: Pick<AmbiguousGenericRequest<Context>, "currentContext">
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
      receiveRequest: async ({ genericRequest, ...args }) => {
        if (genericRequest.input.type === "context_change") {
          return processor.receiveRequest({ ...args, genericRequest });
        }

        let { currentContext, targetID, targetPlatform } = genericRequest;

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

        return processor.receiveRequest({
          ...args,
          genericRequest: { ...genericRequest, currentContext },
        });
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
  return () => {
    return async (processor) => {
      return {
        ...processor,
        sendResponse: async (genericResponse) => {
          const [result] = await Promise.all([
            processor.sendResponse(genericResponse),
            (async function () {
              try {
                await client.setTypingIndicator(genericResponse.targetID, true);
              } catch (error) {
                onSetTypingError(error as Error);
              }
            })(),
          ]);

          try {
            await client.setTypingIndicator(genericResponse.targetID, false);
          } catch (error) {
            onSetTypingError(error as Error);
          }

          return result;
        },
      };
    };
  };
}
