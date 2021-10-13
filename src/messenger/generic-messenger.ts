import {
  compose,
  getRequestPlatform,
  mapSeries,
  requireNotNull,
} from "../common/utils";
import { NextResult } from "../stream";
import {
  AmbiguousPlatform,
  BaseMessageProcessor,
  BaseMessageProcessorConfig,
  FacebookMessageProcessor,
  FacebookRawRequest,
  FacebookRequest,
  MessageProcessorMiddleware,
  Messenger,
  MessengerConfig,
  TelegramMessageProcessor,
  TelegramRawRequest,
  TelegramRequest,
  _MessageProcessorMiddleware,
} from "../type";

/** Create a generic message processor */
export async function createMessageProcessor<
  Context,
  SendResponseResult = unknown
>(
  {
    targetPlatform,
    leafSelector,
    client,
    mapRequest,
    mapResponse,
  }: BaseMessageProcessorConfig<Context>,
  ...middlewares: readonly MessageProcessorMiddleware<Context>[]
): Promise<BaseMessageProcessor<Context, SendResponseResult>> {
  let finalMessageProcessor: BaseMessageProcessor<Context, SendResponseResult>;

  const middlewareInput: _MessageProcessorMiddleware.Input<Context> = {
    getFinalMessageProcessor: () => {
      return finalMessageProcessor;
    },
  };

  const reversedTransformers = [
    ...middlewares.map((m) => {
      return m(middlewareInput);
    }),
  ];

  reversedTransformers.reverse();

  finalMessageProcessor = await compose(
    {
      generalizeRequest: (platformReq) => {
        return mapRequest(platformReq);
      },
      receiveRequest: async (request) => {
        await leafSelector.next(request);
      },
      sendResponse: async (response) => {
        if (response.targetPlatform !== targetPlatform) {
          return;
        }

        const data = await mapResponse(response);

        return mapSeries(data, (datum) => {
          return client.sendResponse(datum);
        });
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

      return mapSeries(genericReq, (req) => {
        return processor.receiveRequest(req);
      });
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
        facebookCallback: (processor) => {
          return processor.generalizeRequest(platformReq as FacebookRawRequest);
        },
        telegramCallback: (processor) => {
          return processor.generalizeRequest(platformReq as TelegramRawRequest);
        },
      });
    },
    receiveRequest: async (request) => {
      return switchPlatform(request.targetPlatform, {
        facebookCallback: (processor) => {
          return processor.receiveRequest(request as FacebookRequest<Context>);
        },
        telegramCallback: (processor) => {
          return processor.receiveRequest(request as TelegramRequest<Context>);
        },
      });
    },
    sendResponse: async (response) => {
      return switchPlatform(response.targetPlatform, {
        facebookCallback: (processor) => {
          return processor.sendResponse(response);
        },
        telegramCallback: (processor) => {
          return processor.sendResponse(response);
        },
      });
    },
  };
}
