import {
  compose,
  genericError,
  getRequestPlatform,
  mapSeries,
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
  MessageProcessorMiddleware,
  Messenger,
} from "../type/messenger";
import { AmbiguousRequest, AmbiguousRequestPerInput } from "../type/request";
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
  GenRequest extends AmbiguousRequest<Context>
>(
  {
    targetPlatform,
    leafSelector,
    client,
    mapRequest,
    mapResponse,
  }: BaseMessageProcessor.Configs<Context, RawRequest, RawResponse, GenRequest>,
  ...middlewares: readonly MessageProcessorMiddleware<
    BaseMessageProcessor<Context, RawRequest, GenRequest>
  >[]
): Promise<BaseMessageProcessor<Context, RawRequest, GenRequest>> {
  let finalMessageProcessor: BaseMessageProcessor<
    Context,
    RawRequest,
    GenRequest
  >;

  const middlewareInput: MessageProcessorMiddleware.Input<BaseMessageProcessor<
    Context,
    RawRequest,
    GenRequest
  >> = {
    getFinalMessageProcessor: () => finalMessageProcessor,
  };

  const reversedTransformers = [...middlewares.map((m) => m(middlewareInput))];
  reversedTransformers.reverse();

  finalMessageProcessor = await compose(
    {
      generalizeRequest: (platformReq) => mapRequest(platformReq),
      receiveRequest: ({ input, ...request }) => {
        return mapSeries(
          input as AmbiguousRequest<Context>["input"],
          (input) => {
            return leafSelector.next({
              ...request,
              input,
            } as AmbiguousRequestPerInput<Context>);
          }
        );
      },
      sendResponse: async (response) => {
        const data = await mapResponse(response);
        return mapSeries(data, (datum) => client.sendResponse(datum));
      },
    },
    ...reversedTransformers
  );

  await leafSelector.subscribe({
    next: async (request) => {
      if (request.targetPlatform === targetPlatform) {
        await finalMessageProcessor.sendResponse(request);
        return NextResult.SUCCESS;
      }

      return NextResult.FAILURE;
    },
    complete: async () => {},
  });

  return finalMessageProcessor;
}

/** Create a messenger */
export function createMessenger<
  Context,
  RawRequest,
  RawResponse,
  GenRequest extends AmbiguousRequest<Context>
>(
  processor: BaseMessageProcessor<Context, RawRequest, GenRequest>
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
