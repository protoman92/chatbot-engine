import { Omit } from 'ts-essentials';
import { Context } from '../type/common';
import { ServiceCommunicator } from '../type/communicator';
import { LeafSelector } from '../type/leaf-selector';
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
 * @template C The shape of the context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A service communicator instance.
 * @param responseMapper Function to map generic response to platform response.
 * @return A generic messenger.
 */
export function createGenericUnitMessenger<C extends Context>(
  leafSelector: LeafSelector<C>,
  communicator: ServiceCommunicator,
  responseMapper: (res: GenericResponse<C>) => Promise<PlatformResponse<C>>
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
    mapRequest: async ({ senderID, oldContext, data }) => {
      const outgoingData = await Promise.all(
        data.map(datum => processInputDatum(oldContext, datum))
      );

      return {
        senderID,
        ...outgoingData.reduce((acc, items) => ({
          newContext: Object.assign(acc.newContext, items.newContext),
          visualContents: [...acc.visualContents, ...items.visualContents]
        }))
      };
    },
    sendResponse: async responses => {
      const data = await responseMapper(responses);
      return communicator.sendResponse(data);
    }
  };

  return messenger;
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @template C The shape of the context used by the current chatbot.
 * @param param0 Required dependencies to perform platform-specific work.
 * @return A generic messenger instance.
 */
export function createGenericMessenger<C extends Context>(
  unitMessenger: UnitMessenger<C>,
  requestMapper: (req: PlatformRequest) => Promise<readonly GenericRequest<C>[]>
): Messenger {
  return {
    processPlatformRequest: platformRequest => {
      return requestMapper(platformRequest).then(requests =>
        Promise.all(
          requests.map(req =>
            unitMessenger
              .mapRequest(req)
              .then(res => unitMessenger.sendResponse(res))
          )
        )
      );
    }
  };
}
