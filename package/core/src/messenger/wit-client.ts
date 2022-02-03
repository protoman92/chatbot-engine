import { requireAllTruthy } from "@haipham/javascript-helper-preconditions";
import { HTTPClient, WitClient, WitConfig, WitResponse } from "../type";
import defaultAxiosClient from "./axios-client";

/** Create a default wit client */
export function createWitClient(
  client: HTTPClient,
  config: WitConfig
): WitClient {
  return {
    validate: (message) => {
      return client.communicate<WitResponse>({
        method: "GET",
        url: `https://api.wit.ai/message?q=${encodeURI(message)}`,
        headers: { Authorization: `Bearer ${config.authorizationToken}` },
      });
    },
  };
}

export default function () {
  const config = { authorizationToken: process.env.WIT_AUTHORIZATION_TOKEN };
  return createWitClient(defaultAxiosClient, requireAllTruthy(config));
}
