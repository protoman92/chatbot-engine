import { HTTPCommunicator } from '../type/communicator';
import { WitCommunicator, WitResponse, WitConfigs } from '../type/wit';

/**
 * Create a default wit communicator.
 * @param comm A HTTP communicator instance.
 * @param param1 Wit configurations.
 * @return A wit communicator instance.
 */
export function createWitCommunicator(
  comm: HTTPCommunicator,
  { authorizationToken }: WitConfigs
): WitCommunicator {
  return {
    validate: message =>
      comm.communicate<WitResponse>({
        method: 'GET',
        url: `https://api.wit.ai/message?q=${message}`,
        headers: { Authorization: `Bearer ${authorizationToken}` }
      })
  };
}
