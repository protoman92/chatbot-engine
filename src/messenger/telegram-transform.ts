import { ContextDAO } from '../type/context-dao';
import { Transformer, DefaultContext } from '../type/common';
import { Telegram } from '../type/telegram';
import { deepClone } from '../common/utils';

/**
 * Save a Telegram user in backend if targetID is not found in context.
 * @template C The context used by the current chatbot.
 */
export function saveTelegramUser<C>(
  contextDAO: ContextDAO<C>,
  saveUser: (user: Telegram.User) => Promise<unknown>
): Transformer<Telegram.Messenger<C>> {
  return async messenger => {
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
        const { targetID } = genericReq;
        const sidKey: keyof DefaultContext = 'targetID';

        if (!oldContext || !(oldContext as any)[sidKey]) {
          await saveUser(user);

          oldContext = deepClone(
            Object.assign(oldContext, { [sidKey]: targetID })
          );

          await contextDAO.setContext(targetID, oldContext);
          genericReqs = genericReqs.map(req => ({ ...req, oldContext }));
        }

        return genericReqs;
      }
    };
  };
}
