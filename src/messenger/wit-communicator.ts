import { HTTPCommunicator } from '../type/communicator';
import { WitCommunicator, WitConfigs, WitResponse } from '../type/wit';

/** Create a default wit communicator. */
export function createWitCommunicator(
  communicator: HTTPCommunicator,
  configs: WitConfigs
): WitCommunicator {
  return {
    validate: message =>
      communicator.communicate<WitResponse>({
        method: 'GET',
        url: `https://api.wit.ai/message?q=${message}`,
        headers: { Authorization: `Bearer ${configs.authorizationToken}` }
      })
  };
}
