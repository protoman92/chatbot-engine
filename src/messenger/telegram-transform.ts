import { DefaultContext, Transformer } from "../type/common";
import { ContextDAO } from "../type/context-dao";
import { Telegram, TelegramMessageProcessor } from "../type/telegram";

/**
 * Save a Telegram user in backend if targetID is not found in context.
 * @template C The context used by the current chatbot.
 */
export function saveTelegramUser<C>(
  contextDAO: ContextDAO<C>,
  saveUser: (user: Telegram.User) => Promise<unknown>
): Transformer<TelegramMessageProcessor<C>> {
  return async processor => {
    return {
      ...processor,
      receiveRequest: async request => {
        const { targetID, telegramUser, oldContext } = request;
        const sidKey: keyof DefaultContext = "targetID";

        if (!oldContext || !(oldContext as any)[sidKey]) {
          await saveUser(telegramUser);
          const additionalContext: {} = { targetID };
          await contextDAO.appendContext(targetID, additionalContext);
        }

        return processor.receiveRequest(request);
      }
    };
  };
}
