import FormData from "form-data";
import { facebookError, requireAllTruthy } from "../common/utils";
import { HTTPClient, HTTPRequest } from "../type/client";
import { FacebookClient, FacebookConfig } from "../type/facebook";
import defaultAxiosClient from "./axios-client";

/** Create a platform client for Facebook */
export function createFacebookClient(
  client: HTTPClient,
  config: FacebookConfig
): FacebookClient {
  function formatURL(...additionalPaths: string[]) {
    return `https://graph.facebook.com/v${
      config.apiVersion
    }/${additionalPaths.join("/")}?access_token=${config.pageToken}`;
  }

  async function get<T>(...additionalPaths: string[]) {
    return client.communicate<T>({
      method: "GET",
      url: formatURL(...additionalPaths),
    });
  }

  async function post<T>({
    additionalPaths,
    body,
    headers: additionalHeaders,
    ...config
  }: Readonly<{
    additionalPaths: string[];
    body: unknown;
  }> &
    Pick<HTTPRequest.POST, "headers" | "maxContentLength">) {
    return client.communicate<T>({
      body,
      method: "POST",
      url: formatURL(...additionalPaths),
      headers: { "Content-Type": "application/json", ...additionalHeaders },
      ...config,
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
      if (mode === "subscribe" && token === config.verifyToken) {
        return challenge;
      }

      throw facebookError("Invalid mode or verify token");
    },
    sendMenuSettings: (data) =>
      post({ body: data, additionalPaths: ["me", "custom_user_settings"] }),
    sendResponse: (data) =>
      post({ body: data, additionalPaths: ["me", "messages"] }),
    setTypingIndicator: (targetID, enabled) => {
      return post({
        body: {
          recipient: { id: targetID },
          sender_action: enabled ? "typing_on" : "typing_off",
        },
        additionalPaths: ["me", "messages"],
      });
    },
    uploadAttachment: async ({ reusable, type, ...attachment }) => {
      /* istanbul ignore else  */
      if ("url" in attachment) {
        const { attachment_id: attachmentID } = await post({
          additionalPaths: ["me", "message_attachments"],
          body: {
            message: {
              attachment: {
                type,
                payload: { is_reusable: !!reusable, url: attachment.url },
              },
            },
          },
        });

        return { attachmentID };
      } else {
        const formData = new FormData();

        formData.append(
          "message",
          JSON.stringify({
            attachment: {
              type,
              payload: { is_reusable: !!reusable },
            },
          })
        );

        formData.append("filedata", attachment.fileData, attachment);

        const { attachment_id: attachmentID } = await post({
          additionalPaths: ["me", "message_attachments"],
          body: formData,
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
        });

        return { attachmentID };
      }
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
