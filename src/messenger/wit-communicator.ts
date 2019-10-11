import { requireAllTruthy } from "../common/utils";
import { HTTPCommunicator } from "../type/communicator";
import { WitCommunicator, WitConfigs, WitResponse } from "../type/wit";
import defaultAxiosCommunicator from "./axios-communicator";

/** Create a default wit communicator. */
export function createWitCommunicator(
  communicator: HTTPCommunicator,
  configs: WitConfigs
): WitCommunicator {
  return {
    validate: message =>
      communicator.communicate<WitResponse>({
        method: "GET",
        url: `https://api.wit.ai/message?q=${message}`,
        headers: { Authorization: `Bearer ${configs.authorizationToken}` }
      })
  };
}

export default function() {
  const { WIT_AUTHORIZATION_TOKEN: authorizationToken } = process.env;
  const config = { authorizationToken };

  return createWitCommunicator(
    defaultAxiosCommunicator,
    requireAllTruthy(config)
  );
}
