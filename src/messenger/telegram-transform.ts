import { MessageProcessorMiddleware } from "../type";
import { ContextDAO } from "../type/context-dao";
import {
  SaveTelegramUserContext,
  TelegramMessageProcessor,
  TelegramUser,
} from "../type/telegram";

/** Save a Telegram user in backend if targetID is not found in context */
export function saveTelegramUser<Context>(
  contextDAO: ContextDAO<Context>,
  saveUser: (user: TelegramUser) => Promise<SaveTelegramUserContext<Context>>
): MessageProcessorMiddleware<TelegramMessageProcessor<Context>> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        const {
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

          await contextDAO.appendContext(targetID, targetPlatform, {
            ...additionalContext,
            targetID: telegramUserID == null ? undefined : `${telegramUserID}`,
          });
        }

        return processor.receiveRequest(request);
      },
    };
  };
}
