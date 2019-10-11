import {
  compose,
  genericError,
  getRequestPlatform,
  mapSeries
} from "../common/utils";
import { Transformer } from "../type/common";
import { Facebook, GenericFacebookRequest } from "../type/facebook";
import {
  BatchMessenger,
  Messenger,
  SupportedPlatform
} from "../type/messenger";
import { GenericRequest, GenericRequestInput } from "../type/request";
import { GenericTelegramRequest, Telegram } from "../type/telegram";

/**
 * Create a generic messenger.
 * @template C The context used by the current chatbot.
 * @template PRequest The platform-specific request.
 * @template PResponse The platform-specific response.
 * @template GRequest The platform-specific generic request.
 */
export async function createMessenger<
  C,
  PRequest,
  PResponse,
  GRequest extends GenericRequest<C>
>(
  {
    targetPlatform,
    leafSelector,
    communicator,
    mapRequest,
    mapResponse
  }: Messenger.Configs<C, PRequest, PResponse, GRequest>,
  ...transformers: readonly Transformer<Messenger<C, PRequest, GRequest>>[]
): Promise<Messenger<C, PRequest, GRequest>> {
  const reversedTransformers = [...transformers];
  reversedTransformers.reverse();

  const messenger: Messenger<C, PRequest, GRequest> = await compose(
    {
      generalizeRequest: platformReq => mapRequest(platformReq),
      receiveRequest: ({ targetID, targetPlatform, oldContext, input }) => {
        return mapSeries(input as readonly GenericRequestInput[], datum => {
          return leafSelector.next({
            ...datum,
            ...oldContext,
            targetID,
            targetPlatform
          });
        });
      },
      sendResponse: async response => {
        const data = await mapResponse(response);
        return mapSeries(data, datum => communicator.sendResponse(datum));
      }
    },
    ...reversedTransformers
  );

  await leafSelector.subscribe({
    next: async ({ targetPlatform: pf, ...restInput }) => {
      if (pf === targetPlatform) {
        return messenger.sendResponse({ ...restInput, targetPlatform: pf });
      }

      return undefined;
    },
    complete: async () => {}
  });

  return messenger;
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @template C The context used by the current chatbot.
 * @template PRequest The platform-specific request.
 * @template PResponse The platform-specific response.
 * @template GRequest The platform-specific generic request.
 */
export function createBatchMessenger<
  C,
  PRequest,
  PResponse,
  GRequest extends GenericRequest<C>
>(
  messenger: Messenger<C, PRequest, GRequest>
): BatchMessenger<PRequest, PResponse> {
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
  {
    facebook,
    telegram
  }: Readonly<{
    facebook?: Facebook.Messenger<C>;
    telegram?: Telegram.Messenger<C>;
  }>,
  getPlatform: (platformReq: unknown) => SupportedPlatform = getRequestPlatform
): BatchMessenger<unknown, unknown> {
  function switchPlatform<FBR, TLR>(
    platform: SupportedPlatform,
    {
      facebookCallback,
      telegramCallback
    }: Readonly<{
      facebookCallback: (messenger: Facebook.Messenger<C>) => Promise<FBR>;
      telegramCallback: (messenger: Telegram.Messenger<C>) => Promise<TLR>;
    }>
  ) {
    switch (platform) {
      case "facebook":
        if (!facebook) break;
        return facebookCallback(facebook);

      case "telegram":
        if (!telegram) break;
        return telegramCallback(telegram);
    }

    throw genericError(`Unsupported platform ${platform}`);
  }

  return createBatchMessenger<C, unknown, unknown, GenericRequest<C>>({
    generalizeRequest: async platformReq => {
      const targetPlatform = getPlatform(platformReq);

      return switchPlatform(targetPlatform, {
        facebookCallback: messenger =>
          messenger.generalizeRequest(platformReq as Facebook.PlatformRequest),
        telegramCallback: messenger =>
          messenger.generalizeRequest(platformReq as Telegram.PlatformRequest)
      });
    },
    receiveRequest: async request => {
      return switchPlatform(request.targetPlatform, {
        facebookCallback: messenger =>
          messenger.receiveRequest(request as GenericFacebookRequest<C>),
        telegramCallback: messenger =>
          messenger.receiveRequest(request as GenericTelegramRequest<C>)
      });
    },
    sendResponse: async response => {
      return switchPlatform(response.targetPlatform, {
        facebookCallback: messenger => messenger.sendResponse(response),
        telegramCallback: messenger => messenger.sendResponse(response)
      });
    }
  });
}
