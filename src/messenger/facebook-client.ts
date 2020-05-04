import { facebookError, requireAllTruthy } from "../common/utils";
import { HTTPClient } from "../type/client";
import { FacebookClient, FacebookConfigs } from "../type/facebook";
import defaultAxiosClient from "./axios-client";

/** Create a platform client for Facebook */
export function createFacebookClient(
  client: HTTPClient,
  configs: FacebookConfigs
): FacebookClient {
  function formatURL(...additionalPaths: string[]) {
    return `https://graph.facebook.com/v${
      configs.apiVersion
    }/${additionalPaths.join("/")}?access_token=${configs.pageToken}`;
  }

  async function get<T>(...additionalPaths: string[]) {
    return client.communicate<T>({
      method: "GET",
      url: formatURL(...additionalPaths),
    });
  }

  async function post<T>(body: unknown, ...additionalPaths: string[]) {
    return client.communicate<T>({
      body,
      method: "POST",
      url: formatURL(...additionalPaths),
      headers: { "Content-Type": "application/json" },
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
      "hub.verify_token": token = "",
    }) => {
      if (mode === "subscribe" && token === configs.verifyToken) {
        return challenge;
      }

      throw facebookError("Invalid mode or verify token");
    },
    sendResponse: (data) => {
      return post(data, "me", "messages");
    },
    setTypingIndicator: (targetID, enabled) => {
      return post(
        {
          recipient: { id: targetID },
          sender_action: enabled ? "typing_on" : "typing_off",
        },
        "me",
        "messages"
      );
    },
  };
}

export default function() {
  const {
    FACEBOOK_API_VERSION = "",
    FACEBOOK_PAGE_TOKEN = "",
    FACEBOOK_VERIFY_TOKEN = "",
  } = process.env;

  const {
    FACEBOOK_API_VERSION: apiVersion,
    FACEBOOK_PAGE_TOKEN: pageToken,
    FACEBOOK_VERIFY_TOKEN: verifyToken,
  } = requireAllTruthy({
    FACEBOOK_API_VERSION,
    FACEBOOK_PAGE_TOKEN,
    FACEBOOK_VERIFY_TOKEN,
  });

  return createFacebookClient(defaultAxiosClient, {
    apiVersion,
    pageToken,
    verifyToken,
  });
}
