import { compose, mapSeries } from '../common/utils';
import { Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { Leaf } from '../type/leaf';
import { Messenger, UnitMessenger } from '../type/messenger';
import { GenericRequest, PlatformRequest } from '../type/request';
import { GenericResponse, PlatformResponse } from '../type/response';
import { Response } from '../type/visual-content';

/**
 * Create a generic unit messenger.
 * @template C The context used by the current chatbot.
 * @template R The response type supported by this messenger.
 * @param leafSelector A leaf selector instance.
 * @param communicator A platform communicator instance.
 * @param responseMapper Function to map generic response to platform responses.
 * @param transformers Array of compose functions to apply on base messenger.
 * @return A generic messenger.
 */
export async function createGenericUnitMessenger<C, R extends Response>(
  leafSelector: Leaf<C>,
  communicator: PlatformCommunicator,
  responseMapper: (
    res: GenericResponse<C>
  ) => Promise<readonly PlatformResponse[]>,
  ...transformers: readonly Transformer<UnitMessenger<C, R>>[]
): Promise<UnitMessenger<C, R>> {
  const messenger: UnitMessenger<C, R> = compose(
    {
      receiveRequest: ({ senderID, oldContext, data }) => {
        return mapSeries(data, datum => {
          return leafSelector.next({ ...datum, ...oldContext, senderID });
        });
      },
      sendResponse: async response => {
        const data = await responseMapper(response);
        return mapSeries(data, datum => communicator.sendResponse(datum));
      }
    },
    ...transformers
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
 * @template R The response type supported by this messenger.
 * @param param0 Required dependencies to perform platform-specific work.
 * @return A generic messenger instance.
 */
export function createGenericMessenger<C, R extends Response>(
  unitMessenger: UnitMessenger<C, R>,
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
