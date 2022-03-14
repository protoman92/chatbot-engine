import { requireNotNull } from "@haipham/javascript-helper-preconditions";
import { getRequestPlatform, mapSeries, transform } from "../common/utils";
import { NextResult } from "../content/leaf";
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
export async function createMessageProcessor(
  {
    targetPlatform,
    leafSelector,
    client,
    mapRequest,
    mapResponse,
  }: BaseMessageProcessorConfig,
  ...middlewares: readonly MessageProcessorMiddleware[]
): Promise<BaseMessageProcessor> {
  let finalMessageProcessor: BaseMessageProcessor;

  const middlewareInput: _MessageProcessorMiddleware.Input = {
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
export function createCrossPlatformMessageProcessor(
  {
    facebook,
    telegram,
  }: Readonly<{
    facebook?: FacebookMessageProcessor;
    telegram?: TelegramMessageProcessor;
  }>,
  getPlatform: (platformReq: unknown) => AmbiguousPlatform = getRequestPlatform
): BaseMessageProcessor {
  function switchPlatform<FBR, TLR>(
    platform: AmbiguousPlatform,
    {
      facebookCallback,
      telegramCallback,
    }: Readonly<{
      facebookCallback: (processor: FacebookMessageProcessor) => Promise<FBR>;
      telegramCallback: (processor: TelegramMessageProcessor) => Promise<TLR>;
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
            genericRequest: genericRequest as FacebookGenericRequest,
          });
        },
        telegramCallback: (processor) => {
          return processor.receiveRequest({
            ...args,
            genericRequest: genericRequest as TelegramGenericRequest,
          });
        },
      });
    },
    sendResponse: async ({ genericResponse, ...args }) => {
      return switchPlatform(genericResponse.targetPlatform, {
        facebookCallback: (processor) => {
          return processor.sendResponse({
            ...args,
            genericResponse: genericResponse as FacebookGenericResponse,
          });
        },
        telegramCallback: (processor) => {
          return processor.sendResponse({
            ...args,
            genericResponse: genericResponse as TelegramGenericResponse,
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
export async function createMessenger({
  leafSelector,
  processor,
}: MessengerConfig): Promise<Messenger> {
  return {
    next: async ({ rawRequest, ...args }) => {
      const genericRequests = await processor.generalizeRequest({
        ...args,
        rawRequest,
      });

      return mapSeries(genericRequests, (genericRequest) => {
        return processor.receiveRequest({ ...args, genericRequest });
      }).then(() => {
        return undefined;
      });
    },
    subscribe: async (observer) => {
      const subscription = await leafSelector.subscribe({
        next: async (response) => {
          await processor.sendResponse({ genericResponse: response });
          await observer.next(undefined);
          return NextResult.BREAK;
        },
      });

      return subscription;
    },
  };
}
