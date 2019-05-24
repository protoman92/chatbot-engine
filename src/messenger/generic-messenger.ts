import { compose, getRequestPlatform, mapSeries } from '../common/utils';
import { STREAM_INVALID_NEXT_RESULT } from '../stream/stream';
import { Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { Facebook } from '../type/facebook';
import { Leaf } from '../type/leaf';
import {
  BatchMessenger,
  CrossPlatformMessengerConfigs,
  Messenger,
  SupportedPlatform
} from '../type/messenger';
import { GenericResponse } from '../type/response';
import { Telegram } from '../type/telegram';

/**
 * Create a generic messenger.
 * @template C The context used by the current chatbot.
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 */
export async function createMessenger<C, PLRequest, PLResponse>(
  senderPlatform: SupportedPlatform,
  leafSelector: Leaf<C>,
  communicator: PlatformCommunicator<PLResponse>,
  requestMapper: Messenger<C, PLRequest>['generalizeRequest'],
  responseMapper: (res: GenericResponse<C>) => Promise<readonly PLResponse[]>,
  ...transformers: readonly Transformer<Messenger<C, PLRequest>>[]
): Promise<Messenger<C, PLRequest>> {
  const messenger: Messenger<C, PLRequest> = compose(
    {
      generalizeRequest: platformReq => requestMapper(platformReq),
      receiveRequest: ({ senderID, senderPlatform, oldContext, data }) => {
        return mapSeries(
          data as readonly (
            | Facebook.GenericRequest.Data
            | Telegram.GenericRequest.Data)[],
          datum => {
            return leafSelector.next({
              ...datum,
              ...oldContext,
              senderID,
              senderPlatform
            });
          }
        );
      },
      sendResponse: async response => {
        const data = await responseMapper(response);
        return mapSeries(data, datum => communicator.sendResponse(datum));
      }
    },
    ...transformers
  );

  await leafSelector.subscribe({
    next: async ({ senderPlatform: pf, ...restInput }) => {
      if (pf === senderPlatform) {
        return messenger.sendResponse({
          senderPlatform: pf,
          ...restInput
        } as GenericResponse<C>);
      }

      return STREAM_INVALID_NEXT_RESULT;
    },
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

      switch (senderPlatform) {
        case 'facebook':
          return messengers.facebook.generalizeRequest(
            platformReq as Facebook.PlatformRequest
          );

        case 'telegram':
          return messengers.telegram.generalizeRequest(
            platformReq as Telegram.PlatformRequest
          );
      }
    },
    receiveRequest: async request => {
      switch (request.senderPlatform) {
        case 'facebook':
          return messengers.facebook.receiveRequest(request);

        case 'telegram':
          return messengers.telegram.receiveRequest(request);
      }
    },
    sendResponse: async response => {
      switch (response.senderPlatform) {
        case 'facebook':
          return messengers.facebook.sendResponse(response);

        case 'telegram':
          return messengers.telegram.sendResponse(response);
      }
    }
  });
}
