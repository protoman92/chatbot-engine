import { isType, toArray } from "@haipham/javascript-helper-utils";
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
  isEnabled,
  saveMessages,
}: Readonly<{
  contextDAO: ContextDAO<Context>;
  isEnabled: () => Promise<boolean>;
  saveMessages: (
    args: Readonly<{
      currentContext: Context;
      rawRequestMessages: readonly (
        | _TelegramRawRequest.Message["message"]
        | _TelegramRawRequest.SuccessfulPayment["message"]
      )[];
    }>
  ) => Promise<void>;
}>): TelegramMessageProcessorMiddleware<Context> {
  function extractRawRequestMessage(
    rawRequest: TelegramRawRequest
  ):
    | _TelegramRawRequest.Message["message"]
    | _TelegramRawRequest.SuccessfulPayment["message"]
    | undefined {
    if (isType<_TelegramRawRequest.Callback>(rawRequest, "callback_query")) {
      return rawRequest.callback_query.message;
    } else if (
      isType<_TelegramRawRequest.PreCheckout>(rawRequest, "pre_checkout_query")
    ) {
      return undefined;
    } else {
      return rawRequest.message;
    }
  }

  return () => {
    return async (processor) => {
      return {
        ...processor,
        receiveRequest: async ({ genericRequest, ...args }) => {
          if (
            !(await isEnabled()) ||
            genericRequest.type !== "message_trigger"
          ) {
            return processor.receiveRequest({ ...args, genericRequest });
          }

          const rawRequestMessages = extractRawRequestMessage(
            genericRequest.rawRequest
          );

          const [result] = await Promise.all([
            processor.receiveRequest({ ...args, genericRequest }),
            ...(rawRequestMessages == null
              ? []
              : [
                  saveMessages({
                    rawRequestMessages: toArray(rawRequestMessages),
                    currentContext: genericRequest.currentContext,
                  }),
                ]),
          ]);

          return result;
        },
        sendResponse: async ({ genericResponse, ...args }) => {
          const sendResults = await processor.sendResponse({
            genericResponse,
            ...args,
          });

          if (await isEnabled()) {
            const currentContext = await contextDAO.getContext({
              targetID: genericResponse.targetID,
              targetPlatform: genericResponse.targetPlatform,
            });

            const rawRequestMessages: Exclude<
              typeof sendResults[number],
              boolean
            >[] = [];

            for (const sendResult of sendResults) {
              if (typeof sendResult === "boolean") {
                continue;
              }

              rawRequestMessages.push(sendResult);
            }

            await saveMessages({ currentContext, rawRequestMessages });
          }

          return sendResults;
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
