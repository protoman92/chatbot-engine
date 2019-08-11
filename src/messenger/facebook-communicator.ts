import { facebookError } from "../common/utils";
import { HTTPCommunicator } from "../type/communicator";
import { Facebook } from "../type/facebook";

/** Create a platform communicator for Facebook. */
export function createFacebookCommunicator(
  communicator: HTTPCommunicator,
  configs: Facebook.Configs
): Facebook.Communicator {
  function formatURL(...additionalPaths: string[]) {
    return `https://graph.facebook.com/v${
      configs.apiVersion
    }/${additionalPaths.join("/")}?access_token=${configs.pageToken}`;
  }

  async function get<T>(...additionalPaths: string[]) {
    return communicator.communicate<T>({
      method: "GET",
      url: formatURL(...additionalPaths)
    });
  }

  async function post<T>(body: unknown, ...additionalPaths: string[]) {
    return communicator.communicate<T>({
      body,
      method: "POST",
      url: formatURL(...additionalPaths),
      headers: { "Content-Type": "application/json" }
    });
  }

  return {
    getUser: async <U>(targetID: string) => {
      const facebookUser = await get<U | undefined | null>(targetID);
      if (!facebookUser) throw Error(`Unable to find user for id ${targetID}`);
      return facebookUser;
    },
    resolveVerifyChallenge: async ({
      "hub.mode": mode = "",
      "hub.challenge": challenge = -1,
      "hub.verify_token": token = ""
    }) => {
      if (mode === "subscribe" && token === configs.verifyToken) {
        return challenge;
      }

      throw facebookError("Invalid mode or verify token");
    },
    sendResponse: data => {
      return post(data, "me", "messages");
    },
    setTypingIndicator: (targetID, enabled) => {
      return post(
        {
          recipient: { id: targetID },
          sender_action: enabled ? "typing_on" : "typing_off"
        },
        "me",
        "messages"
      );
    }
  };
}
