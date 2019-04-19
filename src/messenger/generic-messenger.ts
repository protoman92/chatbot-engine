import { Omit } from 'ts-essentials';
import { Context } from '../type/common';
import { ServiceCommunicator } from '../type/communicator';
import {
  GenericRequest,
  GenericResponse,
  Messenger,
  PlatformRequest,
  PlatformResponse,
  UnitMessenger
} from '../type/messenger';

/**
 * Create a generic unit messenger.
 * @param communicator A service communicator instance.
 * @return A generic messenger.
 */
export function createGenericUnitMessenger<Ctx extends Context>(
  communicator: ServiceCommunicator
): UnitMessenger<Ctx> {
  async function processText(oldContext: Context, text: string) {
    throw new Error('Not implemented');
  }

  async function processDatum(
    oldContext: Context,
    datum: GenericRequest<Ctx>['data'][0]
  ): Promise<Omit<GenericResponse<Ctx>, 'senderID'>> {
    const { text } = datum;

    if (text !== undefined && text !== null) {
      const {} = await processText(oldContext, text);
      throw new Error('Not implemented');
    }

    throw Error(`Cannot process data ${JSON.stringify(datum)}`);
  }

  const messenger: UnitMessenger<Ctx> = {
    processGenericRequest: async ({ senderID, oldContext, data }) => {
      const outgoingData = await Promise.all(
        data.map(datum => processDatum(oldContext, datum))
      );

      return {
        senderID,
        ...outgoingData.reduce((acc, items) => ({
          newContext: Object.assign(acc.newContext, items.newContext),
          data: [...acc.data, ...items.data]
        }))
      };
    },
    sendPlatformResponse: ({ data }) => {
      return Promise.all(data.map(datum => communicator.sendResponse(datum)));
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
export function createGenericMessenger<Ctx extends Context>({
  unitMessenger: messenger,
  requestMapper,
  responseMapper
}: Readonly<{
  unitMessenger: UnitMessenger<Ctx>;
  requestMapper: (req: PlatformRequest) => PromiseLike<GenericRequest<Ctx>[]>;
  responseMapper: (
    res: GenericResponse<Ctx>
  ) => PromiseLike<PlatformResponse<Ctx>>;
}>): Messenger {
  return {
    processPlatformRequest: async platformRequest => {
      const requests = await requestMapper(platformRequest);

      const responses = await Promise.all(
        requests.map(req => messenger.processGenericRequest(req))
      );

      const platformResponses = await Promise.all(
        responses.map(res => responseMapper(res))
      );

      return Promise.all(
        platformResponses.map(res => messenger.sendPlatformResponse(res))
      );
    }
  };
}
