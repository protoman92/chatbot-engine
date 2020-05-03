import {
  compose,
  genericError,
  getRequestPlatform,
  mapSeries,
} from "../common/utils";
import { Transformer } from "../type/common";
import {
  FacebookMessageProcessor,
  FacebookRawRequest,
  FacebookRequest,
} from "../type/facebook";
import {
  Messenger,
  BaseMessageProcessor,
  AmbiguousPlatform,
} from "../type/messenger";
import { AmbiguousRequest, AmbiguousRequestInput } from "../type/request";
import {
  TelegramRequest,
  TelegramMessageProcessor,
  TelegramRawRequest,
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
  GRequest extends AmbiguousRequest<C>
>(
  {
    targetPlatform,
    leafSelector,
    client,
    mapRequest,
    mapResponse,
  }: BaseMessageProcessor.Configs<C, PRequest, PResponse, GRequest>,
  ...transformers: readonly Transformer<
    BaseMessageProcessor<C, PRequest, GRequest>
  >[]
): Promise<BaseMessageProcessor<C, PRequest, GRequest>> {
  const reversedTransformers = [...transformers];
  reversedTransformers.reverse();

  const processor: BaseMessageProcessor<C, PRequest, GRequest> = await compose(
    {
      generalizeRequest: (platformReq) => mapRequest(platformReq),
      receiveRequest: ({ targetID, targetPlatform, oldContext, input }) => {
        return mapSeries(input as readonly AmbiguousRequestInput[], (datum) => {
          return leafSelector.next({
            ...datum,
            ...oldContext,
            targetID,
            targetPlatform,
          });
        });
      },
      sendResponse: async (response) => {
        const data = await mapResponse(response);
        return mapSeries(data, (datum) => client.sendResponse(datum));
      },
    },
    ...reversedTransformers
  );

  await leafSelector.subscribe({
    next: async ({ targetPlatform: pf, ...restInput }) => {
      if (pf === targetPlatform) {
        return processor.sendResponse({
          ...restInput,
          targetPlatform: pf,
        });
      }

      return undefined;
    },
    complete: async () => {},
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
export function createMessenger<
  C,
  PRequest,
  PResponse,
  GRequest extends AmbiguousRequest<C>
>(
  processor: BaseMessageProcessor<C, PRequest, GRequest>
): Messenger<PRequest, PResponse> {
  return {
    processPlatformRequest: async (platformReq) => {
      const genericReq = await processor.generalizeRequest(platformReq);
      return mapSeries(genericReq, (req) => processor.receiveRequest(req));
    },
  };
}

/**
 * Create a cross-platform batch messenger that delegates to the appropriate
 * platform-specific message processor when a request arrives.
 * @template C The context used by the current chatbot.
 */
export function createCrossPlatformMessenger<C>(
  {
    facebook,
    telegram,
  }: Readonly<{
    facebook?: FacebookMessageProcessor<C>;
    telegram?: TelegramMessageProcessor<C>;
  }>,
  getPlatform: (platformReq: unknown) => AmbiguousPlatform = getRequestPlatform
): Messenger<unknown, unknown> {
  function switchPlatform<FBR, TLR>(
    platform: AmbiguousPlatform,
    {
      facebookCallback,
      telegramCallback,
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

  return createMessenger<C, unknown, unknown, AmbiguousRequest<C>>({
    generalizeRequest: async (platformReq) => {
      const targetPlatform = getPlatform(platformReq);

      return switchPlatform(targetPlatform, {
        facebookCallback: (processor) =>
          processor.generalizeRequest(platformReq as FacebookRawRequest),
        telegramCallback: (processor) =>
          processor.generalizeRequest(platformReq as TelegramRawRequest),
      });
    },
    receiveRequest: async (request) => {
      return switchPlatform(request.targetPlatform, {
        facebookCallback: (processor) =>
          processor.receiveRequest(request as FacebookRequest<C>),
        telegramCallback: (processor) =>
          processor.receiveRequest(request as TelegramRequest<C>),
      });
    },
    sendResponse: async (response) => {
      return switchPlatform(response.targetPlatform, {
        facebookCallback: (processor) => processor.sendResponse(response),
        telegramCallback: (processor) => processor.sendResponse(response),
      });
    },
  });
}
