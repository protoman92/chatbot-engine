import { Transformer } from "../type/common";
import { ContextDAO } from "../type/context-dao";
import { Facebook, FacebookMessenger } from "../type/facebook";
import { saveUserForTargetID } from "./messenger-transform";

/** Save a Facebook user when there is no target ID in the context. */
export function saveFacebookUser<C>(
  contextDAO: ContextDAO<C>,
  communicator: Facebook.Communicator,
  saveUser: (facebookUser: Facebook.User) => Promise<unknown>
): Transformer<FacebookMessenger<C>> {
  return saveUserForTargetID(
    contextDAO,
    targetID => communicator.getUser(targetID),
    saveUser
  );
}
