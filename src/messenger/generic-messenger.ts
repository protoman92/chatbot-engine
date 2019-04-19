import { Omit } from 'ts-essentials';
import { Context } from '../type/common';
import { ServiceCommunicator } from '../type/communicator';
import { LeafSelector } from '../type/leaf-selector';
import {
  GenericRequest,
  GenericResponse,
  Messenger,
  MessengerConfigs,
  PlatformRequest,
  PlatformResponse,
  UnitMessenger
} from '../type/messenger';

/**
 * Create a generic unit messenger.
 * @template C The shape of the context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A service communicator instance.
 * @return A generic messenger.
 */
export function createGenericUnitMessenger<C extends Context>(
  leafSelector: LeafSelector<C>,
  communicator: ServiceCommunicator,
  { platform }: MessengerConfigs
): UnitMessenger<C> {
  async function processInputText(oldContext: C, inputText: string) {
    return leafSelector.selectLeaf(oldContext, inputText);
  }

  async function processInputDatum(
    oldContext: C,
    datum: GenericRequest<C>['data'][0]
  ): Promise<Omit<GenericResponse<C>, 'senderID'>> {
    const { text } = datum;

    if (text !== undefined && text !== null) {
      const {} = await processInputText(oldContext, text);
      throw new Error('Not implemented');
    }

    throw Error(`Cannot process data ${JSON.stringify(datum)}`);
  }

  const messenger: UnitMessenger<C> = {
    getContextDAOCacheKey: senderID => `${platform}-${senderID}`,
    mapGenericRequest: async ({ senderID, oldContext, data }) => {
      const outgoingData = await Promise.all(
        data.map(datum => processInputDatum(oldContext, datum))
      );

      return {
        senderID,
        ...outgoingData.reduce((acc, items) => ({
          newContext: Object.assign(acc.newContext, items.newContext),
          outgoingContents: [...acc.outgoingContents, ...items.outgoingContents]
        }))
      };
    },
    sendPlatformResponse: ({ outgoingData: data }) => {
      return Promise.all(data.map(datum => communicator.sendResponse(datum)));
    }
  };

  return messenger;
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @template C The shape of the context used by the current chatbot.
 * @param arg0 Required dependencies to perform platform-specific work.
 * @return A generic messenger instance.
 */
export function createGenericMessenger<C extends Context>({
  unitMessenger: messenger,
  requestMapper,
  responseMapper
}: Readonly<{
  unitMessenger: UnitMessenger<C>;
  requestMapper: (
    req: PlatformRequest
  ) => PromiseLike<readonly GenericRequest<C>[]>;
  responseMapper: (
    res: readonly GenericResponse<C>[]
  ) => PromiseLike<readonly PlatformResponse<C>[]>;
}>): Messenger {
  return {
    processPlatformRequest: async platformRequest => {
      const requests = await requestMapper(platformRequest);

      const responses = await Promise.all(
        requests.map(req => messenger.mapGenericRequest(req))
      );

      const platformResponses = await responseMapper(responses);

      return Promise.all(
        platformResponses.map(res => messenger.sendPlatformResponse(res))
      );
    }
  };
}
