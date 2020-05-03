import { DefaultContext, Transformer } from "../type/common";
import { ContextDAO } from "../type/context-dao";
import { TelegramMessageProcessor, TelegramUser } from "../type/telegram";

/** Save a Telegram user in backend if targetID is not found in context */
export function saveTelegramUser<Context>(
  contextDAO: ContextDAO<Context>,
  saveUser: (user: TelegramUser) => Promise<unknown>
): Transformer<TelegramMessageProcessor<Context>> {
  return async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        const { targetID, targetPlatform, telegramUser, oldContext } = request;
        const sidKey: keyof DefaultContext = "targetID";

        if (!oldContext || !(oldContext as any)[sidKey]) {
          await saveUser(telegramUser);
          const additionalContext: {} = { targetID };

          await contextDAO.appendContext(
            targetID,
            targetPlatform,
            additionalContext
          );
        }

        return processor.receiveRequest(request);
      },
    };
  };
}
