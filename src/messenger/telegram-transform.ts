import { ContextDAO } from '../type/context-dao';
import { Transformer, DefaultContext } from '../type/common';
import { Telegram } from '../type/telegram';
import { deepClone } from '../common/utils';

/**
 * Save a Telegram user in backend if senderID is not found in context.
 * @template C The context used by the current chatbot.
 */
export function saveTelegramUser<C>(
  contextDAO: ContextDAO<C>,
  saveUser: (user: Telegram.User) => Promise<unknown>
): Transformer<Telegram.Messenger<C>> {
  return function saveTelegramUser(messenger: Telegram.Messenger<C>) {
    return {
      ...messenger,
      generalizeRequest: async platformReq => {
        let genericReqs = await messenger.generalizeRequest(platformReq);
        const [genericReq] = genericReqs;

        const {
          message: {
            from: { ...user }
          }
        } = platformReq;

        let { oldContext } = genericReq;
        const { senderID } = genericReq;
        const sidKey: keyof DefaultContext = 'senderID';

        if (!oldContext || !(oldContext as any)[sidKey]) {
          await saveUser(user);

          oldContext = deepClone(
            Object.assign(oldContext, { [sidKey]: senderID })
          );

          await contextDAO.setContext(senderID, oldContext);
          genericReqs = genericReqs.map(req => ({ ...req, oldContext }));
        }

        return genericReqs;
      }
    };
  };
}
