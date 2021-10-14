import { toArray } from "../common/utils";
import {
  AmbiguousGenericRequest,
  ContextDAO,
  TelegramMessageProcessorMiddleware,
  TelegramRawRequest,
  TelegramUser,
  _TelegramRawRequest,
} from "../type";

/**
 * Allow saving Telegram messages when:
 * - Generalizing raw request to generic request.
 * - Sending generic response.
 */
export function saveTelegramMessages<Context>({
  contextDAO,
  saveMessages,
}: Readonly<{
  contextDAO: ContextDAO<Context>;
  saveMessages: (
    args: Readonly<{
      currentContext: Context;
      rawRequestMessages: readonly _TelegramRawRequest.Message["message"][];
    }>
  ) => Promise<void>;
}>): TelegramMessageProcessorMiddleware<Context> {
  function extractRawRequestMessage(
    rawRequest: TelegramRawRequest
  ): _TelegramRawRequest.Message["message"] {
    if ("callback_query" in rawRequest) {
      return rawRequest.callback_query.message;
    } else {
      return rawRequest.message;
    }
  }

  return () => {
    return async (processor) => {
      return {
        ...processor,
        receiveRequest: async ({ genericRequest, ...args }) => {
          if (genericRequest.type !== "message_trigger") {
            return processor.receiveRequest({ ...args, genericRequest });
          }

          const [result] = await Promise.all([
            processor.receiveRequest({ ...args, genericRequest }),
            saveMessages({
              currentContext: genericRequest.currentContext,
              rawRequestMessages: [
                extractRawRequestMessage(genericRequest.rawRequest),
              ],
            }),
          ]);

          return result;
        },
        sendResponse: async ({ genericResponse }) => {
          const sendResult = await processor.sendResponse({ genericResponse });

          const currentContext = await contextDAO.getContext({
            targetID: genericResponse.targetID,
            targetPlatform: genericResponse.targetPlatform,
          });

          await saveMessages({
            currentContext,
            rawRequestMessages: toArray(sendResult),
          });

          return sendResult;
        },
      };
    };
  };
}

/** Save a Telegram user in backend if targetID is not found in context */
export function saveTelegramUser<Context>({
  contextDAO,
  isEnabled,
  saveUser,
}: Readonly<{
  contextDAO: ContextDAO<Context>;
  /**
   * If this returns false, do not get user to save. This helps prevent the
   * logic from being called on every request.
   */
  isEnabled: (
    args: Pick<AmbiguousGenericRequest<Context>, "currentContext">
  ) => Promise<boolean>;
  saveUser: (
    user: TelegramUser
  ) => Promise<Readonly<{ readonly additionalContext?: Partial<Context> }>>;
}>): TelegramMessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async ({ genericRequest, ...args }) => {
        if (genericRequest.type !== "message_trigger") {
          return processor.receiveRequest({ ...args, genericRequest });
        }

        let {
          currentContext,
          targetID,
          targetPlatform,
          telegramUser,
        } = genericRequest;

        if (await isEnabled({ currentContext })) {
          const { additionalContext = {} } = await saveUser(telegramUser);

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
