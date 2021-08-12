import { ContextDAO } from "../type/context-dao";
import { FacebookClient, FacebookUser } from "../type/facebook";
import {
  MessageProcessorMiddleware,
  SaveUserForTargetIDContext,
} from "../type/messenger";
import { saveUserForTargetID } from "./messenger-transform";

/** Save a Facebook user when there is no target ID in the context */
export function saveFacebookUser<Context>({
  contextDAO,
  client,
  saveUser,
}: Readonly<{
  contextDAO: ContextDAO<Context>;
  client: FacebookClient;
  saveUser: (
    facebookUser: FacebookUser
  ) => Promise<SaveUserForTargetIDContext<Context>>;
}>): MessageProcessorMiddleware<Context> {
  return saveUserForTargetID({
    contextDAO,
    saveUser,
    getUser: (targetID) => client.getUser(targetID),
  });
}
