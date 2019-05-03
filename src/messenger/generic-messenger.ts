import { compose, mapSeries } from '../common/utils';
import { ComposeFunc } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { LeafSelector } from '../type/leaf-selector';
import { Messenger, UnitMessenger } from '../type/messenger';
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
export async function createGenericUnitMessenger<C>(
  leafSelector: LeafSelector<C>,
  communicator: PlatformCommunicator,
  responseMapper: (
    res: GenericResponse<C>
  ) => Promise<readonly PlatformResponse[]>,
  ...composeFuncs: readonly ComposeFunc<UnitMessenger<C>>[]
): Promise<UnitMessenger<C>> {
  const messenger: UnitMessenger<C> = compose(
    {
      receiveRequest: ({ senderID, oldContext, data }) => {
        return mapSeries(data, datum => {
          return leafSelector.next({ ...datum, senderID, oldContext });
        });
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
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @template C The context used by the current chatbot.
 * @param param0 Required dependencies to perform platform-specific work.
 * @return A generic messenger instance.
 */
export function createGenericMessenger<C>(
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
