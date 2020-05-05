import { DefaultContext, Transformer } from "../type/common";
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
): Transformer<TelegramMessageProcessor<Context>> {
  return async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        const { targetPlatform, telegramUser, oldContext } = request;
        const sidKey: keyof DefaultContext = "targetID";

        if (!oldContext || !(oldContext as any)[sidKey]) {
          const { additionalContext, telegramUserID } = await saveUser(
            telegramUser
          );

          await contextDAO.appendContext(telegramUserID, targetPlatform, {
            ...additionalContext,
            [sidKey]: telegramUserID,
          });
        }

        return processor.receiveRequest(request);
      },
    };
  };
}
