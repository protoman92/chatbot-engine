import { Omit } from 'ts-essentials';
import { Context } from '../type/common';
import { ServiceCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import { LeafSelector } from '../type/leaf-selector';
import {
  GenericRequest,
  GenericResponse,
  ManualMessenger,
  Messenger,
  PlatformRequest,
  PlatformResponse,
  UnitMessenger
} from '../type/messenger';

/**
 * Create a generic unit messenger.
 * @template C The context used by the current chatbot.
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
  async function processInputText(
    oldContext: C,
    inputText: string
  ): Promise<LeafSelector.Result<C>> {
    return leafSelector.selectLeaf(oldContext, inputText);
  }

  async function processInputDatum(
    oldContext: C,
    datum: GenericRequest<C>['data'][0]
  ): Promise<Omit<GenericResponse<C>, 'senderID'>> {
    const { text } = datum;

    if (text !== undefined && text !== null) {
      return processInputText(oldContext, text);
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
 * Create a manual messenger to trigger handling of manual contents.
 * @template C The context used by the current chatbot.
 * @param contextDAO A context DAO object.
 * @param unitMessenger A unit messenger object.
 * @return A manual messenger instance.
 */
export function createManualMessenger<C extends Context>(
  contextDAO: Pick<ContextDAO<C>, 'getContext'>,
  unitMessenger: Pick<UnitMessenger<C>, 'sendResponse'>
): ManualMessenger {
  return {
    sendManualContent: async (senderID, visualContents) => {
      const newContext = await contextDAO.getContext(senderID);

      return unitMessenger.sendResponse({
        senderID,
        newContext,
        visualContents
      });
    }
  };
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @template C The context used by the current chatbot.
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
