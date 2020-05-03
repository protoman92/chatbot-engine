import { Transformer } from "../type/common";
import { ContextDAO } from "../type/context-dao";
import {
  FacebookClient,
  FacebookMessageProcessor,
  FacebookUser,
} from "../type/facebook";
import { saveUserForTargetID } from "./messenger-transform";

/** Save a Facebook user when there is no target ID in the context. */
export function saveFacebookUser<Context>(
  contextDAO: ContextDAO<Context>,
  client: FacebookClient,
  saveUser: (facebookUser: FacebookUser) => Promise<unknown>
): Transformer<FacebookMessageProcessor<Context>> {
  return saveUserForTargetID(
    contextDAO,
    (targetID) => client.getUser(targetID),
    saveUser
  );
}
