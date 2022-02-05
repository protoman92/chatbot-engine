import { toArray } from "@haipham/javascript-helper-array";
import { isType } from "@haipham/javascript-helper-preconditions";
import { AsyncOrSync } from "ts-essentials";
import { ChatbotContext } from "..";
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
export function saveTelegramMessages({
  contextDAO,
  isEnabled,
  saveMessages,
}: Readonly<{
  contextDAO: ContextDAO;
  isEnabled: () => AsyncOrSync<boolean>;
  saveMessages: (
    args: Readonly<{
      currentContext: ChatbotContext;
      rawRequestMessages: readonly (
        | _TelegramRawRequest.Message["message"]
        | _TelegramRawRequest.SuccessfulPayment["message"]
      )[];
    }>
  ) => AsyncOrSync<void>;
}>): TelegramMessageProcessorMiddleware {
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
    return (processor) => {
      return {
        ...processor,
        receiveRequest: async ({ genericRequest, ...args }) => {
          if (
            !(await Promise.resolve(isEnabled())) ||
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
                  Promise.resolve(
                    saveMessages({
                      rawRequestMessages: toArray(rawRequestMessages),
                      currentContext: genericRequest.currentContext,
                    })
                  ),
                ]),
          ]);

          return result;
        },
        sendResponse: async ({ genericResponse, ...args }) => {
          const sendResults = await processor.sendResponse({
            genericResponse,
            ...args,
          });

          if (await Promise.resolve(isEnabled())) {
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

            await Promise.resolve(
              saveMessages({ currentContext, rawRequestMessages })
            );
          }

          return sendResults;
        },
      };
    };
  };
}

/** Save a Telegram user in backend if targetID is not found in context */
export function saveTelegramUser({
  contextDAO,
  isEnabled,
  saveUser,
}: Readonly<{
  contextDAO: ContextDAO;
  /**
   * If this returns false, do not get user to save. This helps prevent the
   * logic from being called on every request.
   */
  isEnabled: (
    args: Pick<AmbiguousGenericRequest, "currentContext">
  ) => AsyncOrSync<boolean>;
  saveUser: (
    user: TelegramUser
  ) => AsyncOrSync<
    Readonly<{ readonly additionalContext?: Partial<ChatbotContext> }>
  >;
}>): TelegramMessageProcessorMiddleware {
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

        if (await Promise.resolve(isEnabled({ currentContext }))) {
          const { additionalContext = {} } = await Promise.resolve(
            saveUser(telegramUser)
          );

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
