import { Omit } from 'ts-essentials';
import { compose, getRequestPlatform, mapSeries } from '../common/utils';
import { Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { FacebookRequest } from '../type/facebook';
import { Leaf } from '../type/leaf';
import {
  BatchMessenger,
  CrossPlatformBatchMessengerConfigs,
  Messenger,
  SupportedPlatform
} from '../type/messenger';
import { GenericRequest } from '../type/request';
import { GenericResponse } from '../type/response';
import { TelegramRequest } from '../type/telegram';

/**
 * Create a generic messenger.
 * @template C The context used by the current chatbot.
 * @template PlatformResponse The platform-specific response.
 */
export async function createGenericMessenger<C, PlatformResponse>(
  leafSelector: Leaf<C>,
  communicator: PlatformCommunicator<PlatformResponse>,
  responseMapper: (
    res: GenericResponse<C>
  ) => Promise<readonly PlatformResponse[]>,
  ...transformers: readonly Transformer<Messenger<C>>[]
): Promise<Messenger<C>> {
  const messenger: Messenger<C> = compose(
    {
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

export function createCrossPlatformMessenger<C>(
  messengers: Readonly<{ [K in SupportedPlatform]: Messenger<C> }>
): Messenger<C> {
  return {
    receiveRequest: ({ senderPlatform, ...restInput }) => {
      const messenger = messengers[senderPlatform];
      return messenger.receiveRequest({ ...restInput, senderPlatform });
    },
    sendResponse: ({ senderPlatform, ...restInput }) => {
      const messenger = messengers[senderPlatform];
      return messenger.sendResponse({ ...restInput, senderPlatform });
    }
  };
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @template C The context used by the current chatbot.
 * @template PlatformRequest The platform-specific request.
 * @template PlatformResponse The platform-specific response.
 */
export function createBatchMessenger<C, PlatformRequest, PlatformResponse>(
  senderPlatform: SupportedPlatform,
  messenger: Messenger<C>,
  requestMapper: (req: PlatformRequest) => Promise<readonly GenericRequest<C>[]>
): BatchMessenger<PlatformRequest, PlatformResponse> {
  return {
    senderPlatform,
    processPlatformRequest: platformReq => {
      return requestMapper(platformReq).then(requests => {
        return mapSeries(requests, req => messenger.receiveRequest(req));
      });
    }
  };
}

/**
 * Create a cross-platform batch messenger that delegates to the appropriate
 * platform-specific messenger when a request arrives.
 */
export function createCrossPlatformBatchMessenger(
  configs: CrossPlatformBatchMessengerConfigs
): Omit<BatchMessenger<unknown, unknown>, 'senderPlatform'> {
  return {
    processPlatformRequest: platformReq => {
      const senderPlatform = getRequestPlatform(platformReq);

      switch (senderPlatform) {
        case 'facebook':
          const req = platformReq as FacebookRequest;
          return configs.facebook.processPlatformRequest(req);

        case 'telegram':
          const res = platformReq as TelegramRequest;
          return configs.telegram.processPlatformRequest(res);
      }
    }
  };
}
