import { requireAllTruthy } from "../common/utils";
import { HTTPClient } from "../type/client";
import { WitClient, WitConfig, WitResponse } from "../type/wit";
import defaultAxiosClient from "./axios-client";

/** Create a default wit client */
export function createWitClient(
  client: HTTPClient,
  config: WitConfig
): WitClient {
  return {
    validate: (message) =>
      client.communicate<WitResponse>({
        method: "GET",
        url: `https://api.wit.ai/message?q=${message}`,
        headers: { Authorization: `Bearer ${config.authorizationToken}` },
      }),
  };
}

export default function() {
  const { WIT_AUTHORIZATION_TOKEN: authorizationToken } = process.env;
  const config = { authorizationToken };
  return createWitClient(defaultAxiosClient, requireAllTruthy(config));
}
