import {
  AmbiguousRequest,
  ContextDAO,
  TelegramMessageProcessorMiddleware,
  TelegramUser,
} from "../type";

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
    args: Pick<AmbiguousRequest<Context>, "currentContext">
  ) => Promise<boolean>;
  saveUser: (
    user: TelegramUser
  ) => Promise<Readonly<{ readonly additionalContext?: Partial<Context> }>>;
}>): TelegramMessageProcessorMiddleware<Context> {
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

        if (await isEnabled({ currentContext })) {
          const { additionalContext = {} } = await saveUser(telegramUser);

          const { newContext } = await contextDAO.appendContext({
            additionalContext,
            targetID,
            targetPlatform,
          });

          currentContext = newContext;
        }

        return processor.receiveRequest({ ...request, currentContext });
      },
    };
  };
}
