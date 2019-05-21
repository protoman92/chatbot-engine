import { compose, getRequestPlatform, mapSeries } from '../common/utils';
import { Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { Leaf } from '../type/leaf';
import {
  BatchMessenger,
  CrossPlatformMessengerConfigs,
  Messenger,
  SupportedPlatform
} from '../type/messenger';
import { GenericResponse } from '../type/response';

/**
 * Create a generic messenger.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 */
export async function createMessenger<C, PLRequest, PLResponse>(
  leafSelector: Leaf<C>,
  communicator: PlatformCommunicator<PLResponse>,
  requestMapper: Messenger<C, PLRequest>['generalizeRequest'],
  responseMapper: (res: GenericResponse<C>) => Promise<readonly PLResponse[]>,
  ...transformers: readonly Transformer<Messenger<C, PLRequest>>[]
): Promise<Messenger<C, PLRequest>> {
  const messenger: Messenger<C, PLRequest> = compose(
    {
      generalizeRequest: platformReq => requestMapper(platformReq),
      receiveRequest: ({
        senderID,
        senderPlatform,
        oldContext,
        data: data
      }) => {
        return mapSeries(data, datum => {
          return leafSelector.next({
            ...datum,
            ...oldContext,
            senderID,
            senderPlatform
          });
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
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 */
export function createBatchMessenger<C, PLRequest, PLResponse>(
  messenger: Messenger<C, PLRequest>
): BatchMessenger<PLRequest, PLResponse> {
  return {
    processPlatformRequest: async platformReq => {
      const genericReq = await messenger.generalizeRequest(platformReq);
      return mapSeries(genericReq, req => messenger.receiveRequest(req));
    }
  };
}

/**
 * Create a cross-platform batch messenger that delegates to the appropriate
 * platform-specific messenger when a request arrives.
 * @template C The context used by the current chatbot.
 */
export function createCrossPlatformBatchMessenger<C>(
  messengers: CrossPlatformMessengerConfigs<C>,
  getPlatform: (platformReq: unknown) => SupportedPlatform = getRequestPlatform
): BatchMessenger<unknown, unknown> {
  return createBatchMessenger<C, unknown, unknown>({
    generalizeRequest: async platformReq => {
      const senderPlatform = getPlatform(platformReq);
      return messengers[senderPlatform].generalizeRequest(platformReq);
    },
    receiveRequest: async ({ senderPlatform, ...restInput }) => {
      return messengers[senderPlatform].receiveRequest({
        ...restInput,
        senderPlatform
      });
    },
    sendResponse: async ({ senderPlatform, ...restInput }) => {
      return messengers[senderPlatform].sendResponse({
        ...restInput,
        senderPlatform
      });
    }
  });
}
