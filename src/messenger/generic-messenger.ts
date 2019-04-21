import { compose, mapSeries } from '../common/utils';
import { ComposeFunc, Context } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { LeafSelector } from '../type/leaf-selector';
import { ManualMessenger, Messenger, UnitMessenger } from '../type/messenger';
import { GenericRequest, PlatformRequest } from '../type/request';
import { GenericResponse, PlatformResponse } from '../type/response';

/**
 * Create a generic unit messenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A platform communicator instance.
 * @param responseMapper Function to map generic response to platform responses.
 * @param composeFuncs Array of compose functions to apply on base messenger.
 * @return A generic messenger.
 */
export async function createGenericUnitMessenger<C extends Context>(
  leafSelector: LeafSelector<C>,
  communicator: PlatformCommunicator,
  responseMapper: (
    res: GenericResponse<C>
  ) => Promise<readonly PlatformResponse[]>,
  ...composeFuncs: readonly ComposeFunc<UnitMessenger<C>>[]
): Promise<UnitMessenger<C>> {
  const messenger: UnitMessenger<C> = compose(
    {
      receiveRequest: async ({ senderID, oldContext, data }) => {
        return mapSeries(data, ({ inputText = '' }) =>
          leafSelector.next({ senderID, oldContext, inputText })
        );
      },
      sendResponse: async response => {
        const data = await responseMapper(response);
        return mapSeries(data, datum => communicator.sendResponse(datum));
      }
    },
    ...composeFuncs
  );

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
  unitMessenger: Pick<UnitMessenger<C>, 'sendResponse'>
): ManualMessenger {
  return {
    sendManualContent: async (senderID, visualContents) => {
      return unitMessenger.sendResponse({ senderID, visualContents });
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
      return requestMapper(platformRequest).then(requests => {
        return mapSeries(requests, req => unitMessenger.receiveRequest(req));
      });
    }
  };
}
