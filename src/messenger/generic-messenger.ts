import { Omit } from 'ts-essentials';
import { Context } from '../common/type';
import { ServiceCommunicator } from './service-communicator';
import {
  GenericRequest,
  GenericResponse,
  PlatformRequest,
  PlatformResponse,
  GenericUnitMessenger,
  GenericMessenger
} from './type';

/**
 * Create a generic unit messenger.
 * @param communicator A service communicator instance.
 * @return A generic messenger.
 */
export function createGenericUnitMessenger(
  communicator: ServiceCommunicator
): GenericUnitMessenger {
  async function processText(oldContext: Context, text: string) {
    throw new Error('Not implemented');
  }

  async function processDatum(
    oldContext: Context,
    datum: GenericRequest['data'][0]
  ): Promise<Omit<GenericResponse, 'senderID'>> {
    const { text } = datum;

    if (text !== undefined && text !== null) {
      const {} = await processText(oldContext, text);
      throw new Error('Not implemented');
    }

    throw Error(`Cannot process data ${JSON.stringify(datum)}`);
  }

  const messenger: GenericUnitMessenger = {
    processGenericRequest: async ({ senderID, oldContext, data }) => {
      const outgoingData = await Promise.all(
        data.map(async datum => processDatum(oldContext, datum))
      );

      return {
        senderID,
        ...outgoingData.reduce((acc, items) => ({
          newContext: Object.assign(acc.newContext, items.newContext),
          data: [...acc.data, ...items.data]
        }))
      };
    },
    sendPlatformResponse: async ({ data }) => {
      return Promise.all(
        data.map(async datum => communicator.sendResponse(datum))
      );
    }
  };

  return messenger;
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @param arg0 Required dependencies to perform platform-specific work.
 * @return A generic messenger instance.
 */
export function createGenericMessenger({
  unitMessenger: messenger,
  requestMapper,
  responseMapper
}: Readonly<{
  unitMessenger: GenericUnitMessenger;
  requestMapper: (req: PlatformRequest) => PromiseLike<GenericRequest[]>;
  responseMapper: (res: GenericResponse) => PromiseLike<PlatformResponse>;
}>): GenericMessenger {
  return {
    processPlatformRequest: async platformRequest => {
      const requests = await requestMapper(platformRequest);

      const responses = await Promise.all(
        requests.map(async req => messenger.processGenericRequest(req))
      );

      const platformResponses = await Promise.all(
        responses.map(async res => responseMapper(res))
      );

      return Promise.all(
        platformResponses.map(async res => messenger.sendPlatformResponse(res))
      );
    }
  };
}
