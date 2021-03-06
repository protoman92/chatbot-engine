import { MessageProcessorMiddleware } from "../type";
import { ContextDAO } from "../type/context-dao";
import { SaveTelegramUserContext, TelegramUser } from "../type/telegram";

/** Save a Telegram user in backend if targetID is not found in context */
export function saveTelegramUser<Context>(
  contextDAO: ContextDAO<Context>,
  saveUser: (user: TelegramUser) => Promise<SaveTelegramUserContext<Context>>
): MessageProcessorMiddleware<Context> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        if (
          request.type !== "message_trigger" ||
          request.targetPlatform !== "telegram"
        ) {
          return processor.receiveRequest(request);
        }

        let {
          currentContext,
          targetID,
          targetPlatform,
          telegramUser,
        } = request;

        if (!currentContext || !(currentContext as any)["targetID"]) {
          const {
            additionalContext = {} as Partial<Context>,
            telegramUserID,
          } = await saveUser(telegramUser);

          const { newContext } = await contextDAO.appendContext({
            targetID,
            targetPlatform,
            context: {
              ...additionalContext,
              targetID:
                telegramUserID == null ? undefined : `${telegramUserID}`,
            },
          });

          currentContext = newContext;
        }

        return processor.receiveRequest({ ...request, currentContext });
      },
    };
  };
}
