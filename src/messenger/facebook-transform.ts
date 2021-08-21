import { FacebookClient, FacebookUser } from "../type/facebook";
import { MessageProcessorMiddleware } from "../type/messenger";
import {
  saveUserForTargetID,
  SaveUserForTargetIDArgs,
} from "./messenger-transform";

/** Save a Facebook user when there is no target ID in the context */
export function saveFacebookUser<Context>({
  client,
  ...args
}: Pick<
  SaveUserForTargetIDArgs<Context, FacebookUser>,
  "contextDAO" | "isEnabled" | "saveUser"
> &
  Readonly<{ client: FacebookClient }>): MessageProcessorMiddleware<Context> {
  return saveUserForTargetID({
    ...args,
    getUser: (targetID) => {
      return client.getUser(targetID);
    },
  });
}
