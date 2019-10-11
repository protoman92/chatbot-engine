import {
  compose,
  genericError,
  getRequestPlatform,
  mapSeries
} from "../common/utils";
import { Transformer } from "../type/common";
import {
  FacebookMessageProcessor,
  FacebookPlatformRequest,
  GenericFacebookRequest
} from "../type/facebook";
import {
  BatchMessenger,
  RootMessageProcessor,
  SupportedPlatform
} from "../type/messenger";
import { GenericRequest, GenericRequestInput } from "../type/request";
import {
  GenericTelegramRequest,
  TelegramMessageProcessor,
  TelegramPlatformRequest
} from "../type/telegram";

/**
 * Create a generic message processor.
 * @template C The context used by the current chatbot.
 * @template PRequest The platform-specific request.
 * @template PResponse The platform-specific response.
 * @template GRequest The platform-specific generic request.
 */
export async function createMessageProcessor<
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
  }: RootMessageProcessor.Configs<C, PRequest, PResponse, GRequest>,
  ...transformers: readonly Transformer<
    RootMessageProcessor<C, PRequest, GRequest>
  >[]
): Promise<RootMessageProcessor<C, PRequest, GRequest>> {
  const reversedTransformers = [...transformers];
  reversedTransformers.reverse();

  const processor: RootMessageProcessor<C, PRequest, GRequest> = await compose(
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
        return processor.sendResponse({
          ...restInput,
          targetPlatform: pf
        });
      }

      return undefined;
    },
    complete: async () => {}
  });

  return processor;
}

/**
 * Create a messenger.
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
  processor: RootMessageProcessor<C, PRequest, GRequest>
): BatchMessenger<PRequest, PResponse> {
  return {
    processPlatformRequest: async platformReq => {
      const genericReq = await processor.generalizeRequest(platformReq);
      return mapSeries(genericReq, req => processor.receiveRequest(req));
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
    facebook?: FacebookMessageProcessor<C>;
    telegram?: TelegramMessageProcessor<C>;
  }>,
  getPlatform: (platformReq: unknown) => SupportedPlatform = getRequestPlatform
): BatchMessenger<unknown, unknown> {
  function switchPlatform<FBR, TLR>(
    platform: SupportedPlatform,
    {
      facebookCallback,
      telegramCallback
    }: Readonly<{
      facebookCallback: (
        processor: FacebookMessageProcessor<C>
      ) => Promise<FBR>;
      telegramCallback: (
        processor: TelegramMessageProcessor<C>
      ) => Promise<TLR>;
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
        facebookCallback: processor =>
          processor.generalizeRequest(platformReq as FacebookPlatformRequest),
        telegramCallback: processor =>
          processor.generalizeRequest(platformReq as TelegramPlatformRequest)
      });
    },
    receiveRequest: async request => {
      return switchPlatform(request.targetPlatform, {
        facebookCallback: processor =>
          processor.receiveRequest(request as GenericFacebookRequest<C>),
        telegramCallback: processor =>
          processor.receiveRequest(request as GenericTelegramRequest<C>)
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
