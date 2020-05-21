import {
  compose,
  getRequestPlatform,
  mapSeries,
  requireNotNull,
} from "../common/utils";
import { NextResult } from "../stream";
import {
  FacebookMessageProcessor,
  FacebookRawRequest,
  FacebookRequest,
} from "../type/facebook";
import {
  AmbiguousPlatform,
  BaseMessageProcessor,
  BaseMessageProcessorConfig,
  MessageProcessorMiddleware,
  Messenger,
  MessengerConfig,
} from "../type/messenger";
import {
  TelegramMessageProcessor,
  TelegramRawRequest,
  TelegramRequest,
} from "../type/telegram";

/** Create a generic message processor */
export async function createMessageProcessor<Context>(
  {
    targetPlatform,
    leafSelector,
    client,
    mapRequest,
    mapResponse,
  }: BaseMessageProcessorConfig<Context>,
  ...middlewares: readonly MessageProcessorMiddleware<Context>[]
): Promise<BaseMessageProcessor<Context>> {
  let finalMessageProcessor: BaseMessageProcessor<Context>;

  const middlewareInput: MessageProcessorMiddleware.Input<Context> = {
    getFinalMessageProcessor: () => finalMessageProcessor,
  };

  const reversedTransformers = [...middlewares.map((m) => m(middlewareInput))];
  reversedTransformers.reverse();

  finalMessageProcessor = await compose(
    {
      generalizeRequest: (platformReq) => mapRequest(platformReq),
      receiveRequest: (request) => leafSelector.next(request),
      sendResponse: async (response) => {
        if (response.targetPlatform !== targetPlatform) return;
        const data = await mapResponse(response);
        return mapSeries(data, (datum) => client.sendResponse(datum));
      },
    },
    ...reversedTransformers
  );

  return finalMessageProcessor;
}

/** Create a messenger */
export async function createMessenger<Context>({
  leafSelector,
  processor,
}: MessengerConfig<Context>): Promise<Messenger<Context>> {
  await leafSelector.subscribe({
    next: async (response) => {
      await processor.sendResponse(response);
      return NextResult.BREAK;
    },
    complete: async () => {},
  });

  return {
    processRawRequest: async (platformReq) => {
      const genericReq = await processor.generalizeRequest(platformReq);
      return mapSeries(genericReq, (req) => processor.receiveRequest(req));
    },
  };
}

/**
 * Create a cross-platform message processor that delegates to the appropriate
 * platform-specific message processor when a request arrives.
 */
export function createCrossPlatformMessageProcessor<Context>(
  {
    facebook,
    telegram,
  }: Readonly<{
    facebook?: FacebookMessageProcessor<Context>;
    telegram?: TelegramMessageProcessor<Context>;
  }>,
  getPlatform: (platformReq: unknown) => AmbiguousPlatform = getRequestPlatform
): BaseMessageProcessor<Context> {
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
        return facebookCallback(requireNotNull(facebook));

      case "telegram":
        return telegramCallback(requireNotNull(telegram));
    }
  }

  return {
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
  };
}
