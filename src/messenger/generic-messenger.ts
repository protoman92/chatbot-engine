import {
  compose,
  genericError,
  getRequestPlatform,
  mapSeries,
} from "../common/utils";
import { NextResult } from "../stream";
import { Transformer } from "../type/common";
import {
  FacebookMessageProcessor,
  FacebookRawRequest,
  FacebookRequest,
} from "../type/facebook";
import {
  AmbiguousPlatform,
  BaseMessageProcessor,
  Messenger,
} from "../type/messenger";
import { AmbiguousRequest, AmbiguousRequestInput } from "../type/request";
import {
  TelegramMessageProcessor,
  TelegramRawRequest,
  TelegramRequest,
} from "../type/telegram";

/** Create a generic message processor */
export async function createMessageProcessor<
  Context,
  RawRequest,
  RawResponse,
  AmbRequest extends AmbiguousRequest<Context>
>(
  {
    targetPlatform,
    leafSelector,
    client,
    mapRequest,
    mapResponse,
  }: BaseMessageProcessor.Configs<Context, RawRequest, RawResponse, AmbRequest>,
  ...transformers: readonly Transformer<
    BaseMessageProcessor<Context, RawRequest, AmbRequest>
  >[]
): Promise<BaseMessageProcessor<Context, RawRequest, AmbRequest>> {
  const reversedTransformers = [...transformers];
  reversedTransformers.reverse();

  const processor: BaseMessageProcessor<
    Context,
    RawRequest,
    AmbRequest
  > = await compose(
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
        await processor.sendResponse({
          ...restInput,
          targetPlatform: pf,
        });

        return NextResult.SUCCESS;
      }

      return NextResult.FAILURE;
    },
    complete: async () => {},
  });

  return processor;
}

/** Create a messenger */
export function createMessenger<
  Context,
  RawRequest,
  RawResponse,
  AmbRequest extends AmbiguousRequest<Context>
>(
  processor: BaseMessageProcessor<Context, RawRequest, AmbRequest>
): Messenger<RawRequest, RawResponse> {
  return {
    processRawRequest: async (platformReq) => {
      const genericReq = await processor.generalizeRequest(platformReq);
      return mapSeries(genericReq, (req) => processor.receiveRequest(req));
    },
  };
}

/**
 * Create a cross-platform batch messenger that delegates to the appropriate
 * platform-specific message processor when a request arrives.
 */
export function createCrossPlatformMessenger<Context>(
  {
    facebook,
    telegram,
  }: Readonly<{
    facebook?: FacebookMessageProcessor<Context>;
    telegram?: TelegramMessageProcessor<Context>;
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
        processor: FacebookMessageProcessor<Context>
      ) => Promise<FBR>;
      telegramCallback: (
        processor: TelegramMessageProcessor<Context>
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

  return createMessenger<Context, unknown, unknown, AmbiguousRequest<Context>>({
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
          processor.receiveRequest(request as FacebookRequest<Context>),
        telegramCallback: (processor) =>
          processor.receiveRequest(request as TelegramRequest<Context>),
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
