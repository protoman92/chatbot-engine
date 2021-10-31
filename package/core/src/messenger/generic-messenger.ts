import { requireNotNull } from "@haipham/javascript-helper-utils";
import { getRequestPlatform, mapSeries, transform } from "../common/utils";
import { NextResult } from "../stream";
import {
  AmbiguousPlatform,
  BaseMessageProcessor,
  BaseMessageProcessorConfig,
  FacebookGenericRequest,
  FacebookGenericResponse,
  FacebookMessageProcessor,
  FacebookRawRequest,
  MessageProcessorMiddleware,
  Messenger,
  MessengerConfig,
  TelegramGenericRequest,
  TelegramGenericResponse,
  TelegramMessageProcessor,
  TelegramRawRequest,
  _MessageProcessorMiddleware,
} from "../type";

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

  finalMessageProcessor = await transform(
    {
      generalizeRequest: (rawRequest) => {
        return mapRequest(rawRequest);
      },
      receiveRequest: async ({ genericRequest }) => {
        await leafSelector.next(genericRequest);
      },
      sendResponse: async ({ genericResponse }) => {
        if (genericResponse.targetPlatform !== targetPlatform) {
          return;
        }

        const data = await mapResponse(genericResponse);

        return mapSeries(data, (datum) => {
          return client.sendResponse(datum);
        });
      },
    },
    ...reversedTransformers
  );

  return finalMessageProcessor;
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
    generalizeRequest: async ({ rawRequest, ...args }) => {
      const targetPlatform = getPlatform(rawRequest);

      return switchPlatform(targetPlatform, {
        facebookCallback: (processor) => {
          return processor.generalizeRequest({
            ...args,
            rawRequest: rawRequest as FacebookRawRequest,
          });
        },
        telegramCallback: (processor) => {
          return processor.generalizeRequest({
            ...args,
            rawRequest: rawRequest as TelegramRawRequest,
          });
        },
      });
    },
    receiveRequest: async ({ genericRequest, ...args }) => {
      return switchPlatform(genericRequest.targetPlatform, {
        facebookCallback: (processor) => {
          return processor.receiveRequest({
            ...args,
            genericRequest: genericRequest as FacebookGenericRequest<Context>,
          });
        },
        telegramCallback: (processor) => {
          return processor.receiveRequest({
            ...args,
            genericRequest: genericRequest as TelegramGenericRequest<Context>,
          });
        },
      });
    },
    sendResponse: async ({ genericResponse, ...args }) => {
      return switchPlatform(genericResponse.targetPlatform, {
        facebookCallback: (processor) => {
          return processor.sendResponse({
            ...args,
            genericResponse: genericResponse as FacebookGenericResponse<
              Context
            >,
          });
        },
        telegramCallback: (processor) => {
          return processor.sendResponse({
            ...args,
            genericResponse: genericResponse as TelegramGenericResponse<
              Context
            >,
          });
        },
      });
    },
  };
}

/**
 * Create a messenger. Make sure the leaf selector passed here is the same one
 * passed to the message processor.
 */
export async function createMessenger<Context>({
  leafSelector,
  processor,
}: MessengerConfig<Context>): Promise<Messenger> {
  await leafSelector.subscribe({
    next: async (response) => {
      await processor.sendResponse({ genericResponse: response });
      return NextResult.BREAK;
    },
    complete: async () => {},
  });

  return {
    processRawRequest: async ({ rawRequest, ...args }) => {
      const genericRequests = await processor.generalizeRequest({
        ...args,
        rawRequest,
      });

      return mapSeries(genericRequests, (genericRequest) => {
        return processor.receiveRequest({ ...args, genericRequest });
      });
    },
  };
}
