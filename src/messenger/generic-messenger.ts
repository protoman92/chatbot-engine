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
 * @param responseMapper Function to map generic response to platform responses.
 * @return A generic messenger.
 */
export async function createGenericUnitMessenger<C extends Context>(
  leafSelector: LeafSelector<C>,
  communicator: ServiceCommunicator,
  responseMapper: (
    res: GenericResponse<C>
  ) => Promise<readonly PlatformResponse[]>
): Promise<UnitMessenger<C>> {
  const messenger: UnitMessenger<C> = {
    receiveRequest: async ({ senderID, oldContext, data }) => {
      data.forEach(({ text = '' }) =>
        leafSelector.next({ senderID, oldContext, text })
      );
    },
    sendResponse: async response => {
      const data = await responseMapper(response);
      return Promise.all(data.map(datum => communicator.sendResponse(datum)));
    }
  };

  await leafSelector.subscribe({
    next: response => messenger.sendResponse(response),
    complete: async () => {}
  });

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
        Promise.all(requests.map(req => unitMessenger.receiveRequest(req)))
      );
    }
  };
}
