import {
  FacebookClient,
  FacebookMessageProcessorMiddleware,
  FacebookUser,
} from "../type";
import {
  saveUserForTargetID,
  SaveUserForTargetIDArgs,
} from "./messenger-transform";

/** Save a Facebook user when there is no target ID in the context */
export function saveFacebookUser({
  client,
  ...args
}: Pick<
  SaveUserForTargetIDArgs<FacebookUser>,
  "contextDAO" | "isEnabled" | "saveUser"
> &
  Readonly<{ client: FacebookClient }>): FacebookMessageProcessorMiddleware {
  return saveUserForTargetID({
    ...args,
    getUser: (targetID) => {
      return client.getUser(targetID);
    },
  }) as FacebookMessageProcessorMiddleware;
}
