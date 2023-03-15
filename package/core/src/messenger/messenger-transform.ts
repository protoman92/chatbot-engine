import { ChatbotContext } from "..";
import {
  AmbiguousGenericRequest,
  ContextDAO,
  FacebookMessageProcessorMiddleware,
  MessageProcessorMiddleware,
  PlatformClientTypingIndicatorSetter,
} from "../type";

/**
 * Inject the relevant context for a target every time a message group is
 * processed.
 */
function injectContextOnReceive({
  contextDAO,
}: Readonly<{
  contextDAO: Pick<ContextDAO, "getContext">;
}>): MessageProcessorMiddleware {
  return () => {
    return async (processor) => {
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
  };
}

const injectFacebookContextOnReceive = injectContextOnReceive as (
  ...args: Parameters<typeof injectContextOnReceive>
) => FacebookMessageProcessorMiddleware;

/**
 * Instead of grouping all platform-specific context injection mechanisms
 * under one function, we shall export this platform-by-platform, and provide
 * a customized implementation when necesssary.
 *
 * For example, the Telegram context injection must use the current user's ID
 * instead of the targetID, because the targetID could be pointing to a
 * group's ID (if the bot is responding to messages in a group).
 */
export { injectFacebookContextOnReceive };

/**
 * Save the context every time a message group is sent to a target ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 */
export function saveContextOnSend({
  contextDAO,
  preSaveContextMapper,
}: Readonly<{
  contextDAO: Pick<ContextDAO, "getContext" | "appendContext">;
  preSaveContextMapper?: (
    context: Partial<ChatbotContext>
  ) => Promise<Partial<ChatbotContext>> | Partial<ChatbotContext>;
}>): MessageProcessorMiddleware {
  return ({ getFinalMessageProcessor }) => async (processor) => {
    return {
      ...processor,
      sendResponse: async ({ genericResponse, ...args }) => {
        const result = await processor.sendResponse({
          ...args,
          genericResponse,
        });

        /**
         * We could send the response and emit the context_change request at
         * the same time (which would improve performance), but it might cause
         * issue with message ordering, especially if we have a handler that
         * listens to context changes and sends related messages.
         */
        if (genericResponse.additionalContext != null) {
          let additionalContext = genericResponse.additionalContext;

          if (preSaveContextMapper != null) {
            additionalContext = await preSaveContextMapper(additionalContext);
          }

          const { newContext, oldContext } = await contextDAO.appendContext({
            additionalContext,
            targetID: genericResponse.targetID,
            targetPlatform: genericResponse.targetPlatform,
            oldContext: genericResponse.originalRequest?.currentContext,
          });

          const finalProcessor = getFinalMessageProcessor();

          await finalProcessor.receiveRequest({
            ...args,
            genericRequest: {
              currentContext: newContext,
              input: {
                newContext,
                oldContext,
                changedContext: additionalContext,
                type: "context_change",
              },
              originalRequest: genericResponse.originalRequest,
              targetID: genericResponse.targetID,
              targetPlatform: genericResponse.targetPlatform,
              triggerType: "manual",
            },
          });
        }

        return result;
      },
    };
  };
}

export interface SaveUserForTargetIDArgs<RawUser> {
  readonly contextDAO: ContextDAO;
  getUser(targetID: string): Promise<RawUser>;
  /**
   * If this returns false, do not get user to save. This helps prevent the
   * logic from being called on every request.
   */
  isEnabled(
    args: Pick<AmbiguousGenericRequest, "currentContext">
  ): Promise<boolean>;
  saveUser(
    rawUser: RawUser
  ): Promise<Readonly<{ additionalContext?: Partial<ChatbotContext> }>>;
}

/**
 * Save user in backend if there is no target ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 */
export function saveUserForTargetID<RawUser>({
  contextDAO,
  getUser,
  isEnabled,
  saveUser,
}: SaveUserForTargetIDArgs<RawUser>): MessageProcessorMiddleware {
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
export function setTypingIndicator({
  client,
  onSetTypingError = (error) => {
    throw error;
  },
}: Readonly<{
  client: PlatformClientTypingIndicatorSetter;
  onSetTypingError?: (e: Error) => void;
}>): MessageProcessorMiddleware {
  return () => {
    return async (processor) => {
      return {
        ...processor,
        sendResponse: async ({ genericResponse, ...args }) => {
          const [result] = await Promise.all([
            processor.sendResponse({ ...args, genericResponse }),
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
