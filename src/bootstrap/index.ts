import express from "express";
import rateLimitter from "express-rate-limit";
import { StrictOmit } from "ts-essentials";
import {
  catchAll,
  catchError,
  createDefaultErrorLeaf,
  createLeafSelector,
  createTransformChain,
  retryWithWit,
} from "../content";
import {
  createCrossPlatformMessageProcessor,
  createFacebookMessageProcessor,
  createMessenger,
  createTelegramMessageProcessor,
  defaultFacebookClient as createFacebookClient,
  defaultTelegramClient as createTelegramClient,
  defaultWitClient as createWitClient,
} from "../messenger";
import {
  AmbiguousPlatform,
  AmbiguousRequest,
  Branch,
  ContextDAO,
  ErrorLeafConfig,
  LeafSelector,
  MessageProcessorMiddleware,
} from "../type";
import {
  DefaultAsynchronousDependencies,
  DefaultLeafDependencies,
} from "./interface";
import createCaptureGenericResponseMiddleware from "./middleware/capture_generic_response";
import ContextRoute from "./route/bootstrap_context_route";
import WebhookRoute from "./route/bootstrap_webhook_route";

export type ChatbotBootstrapArgs<
  Context,
  LeafDependencies extends DefaultLeafDependencies<Context>
> = Omit<LeafDependencies, keyof DefaultLeafDependencies<Context>> &
  Readonly<{
    contextDAO: ContextDAO<Context>;
    messageProcessorMiddlewares?: Readonly<{
      facebook?: readonly MessageProcessorMiddleware<Context>[];
      telegram?: readonly MessageProcessorMiddleware<Context>[];
    }>;
    onWebhookError: (
      args: Readonly<{
        error: Error;
        payload: unknown;
        platform: AmbiguousPlatform;
      }>
    ) => Promise<void>;
  }> &
  (
    | {
        createLeafSelector: (
          args: LeafDependencies
        ) => Promise<LeafSelector<Context>>;
        leafSelectorType: "custom";
      }
    | {
        createBranches: (args: LeafDependencies) => Promise<Branch<Context>>;
        formatErrorMessage: ErrorLeafConfig["formatErrorMessage"];
        leafSelectorType: "default";
        onLeafCatchAll: (request: AmbiguousRequest<Context>) => Promise<void>;
        onLeafError?: NonNullable<ErrorLeafConfig["trackError"]>;
      }
  );

export default function createChatbotRouter<
  Context,
  LeafDependencies extends DefaultLeafDependencies<
    Context
  > = DefaultLeafDependencies<Context>
>({
  getChatbotBootstrapArgs,
  webhookTimeout,
}: Readonly<{
  getChatbotBootstrapArgs: (
    args: StrictOmit<DefaultLeafDependencies<Context>, "contextDAO">
  ) => ChatbotBootstrapArgs<Context, LeafDependencies>;
  /**
   *
   * If we don't specify a timeout, the webhook will be repeatedly called
   * again. Need to check for why that's the case, but do not hog the entire
   * bot.
   */
  webhookTimeout: number;
}>) {
  const env = process.env.NODE_ENV || "";
  const facebookClient = createFacebookClient();
  const telegramClient = createTelegramClient({ defaultParseMode: "html" });

  const bootstrapArgs = getChatbotBootstrapArgs({
    env,
    facebookClient,
    getAsyncDependencies,
    telegramClient,
    webhookTimeout,
  });

  let messengerComponents:
    | Promise<DefaultAsynchronousDependencies<Context>>
    | undefined;

  function getAsyncDependencies() {
    if (messengerComponents == null) {
      messengerComponents = new Promise(async (resolve) => {
        let leafSelector: LeafSelector<Context>;

        switch (bootstrapArgs.leafSelectorType) {
          case "custom": {
            leafSelector = await createTransformChain()
              .forContextOfType<Context>()
              .transform(await bootstrapArgs.createLeafSelector(dependencies));

            break;
          }

          case "default": {
            const witClient = await createWitClient();
            const branches = await bootstrapArgs.createBranches(dependencies);

            leafSelector = await createTransformChain()
              .forContextOfType<Context>()
              .pipe(retryWithWit(witClient))
              .pipe(catchAll(bootstrapArgs.onLeafCatchAll))
              .pipe(
                catchError(
                  await createDefaultErrorLeaf({
                    formatErrorMessage: bootstrapArgs.formatErrorMessage,
                    trackError: bootstrapArgs.onLeafError,
                  })
                )
              )
              .transform(createLeafSelector(branches));
          }
        }

        const facebookProcessor = await createFacebookMessageProcessor(
          { leafSelector, client: facebookClient },
          ...(bootstrapArgs.messageProcessorMiddlewares?.facebook ?? []),
          createCaptureGenericResponseMiddleware()
        );

        const telegramProcessor = await createTelegramMessageProcessor(
          { leafSelector, client: telegramClient },
          ...(bootstrapArgs?.messageProcessorMiddlewares?.telegram ?? []),
          createCaptureGenericResponseMiddleware()
        );

        const messageProcessor = createCrossPlatformMessageProcessor({
          facebook: facebookProcessor,
          telegram: telegramProcessor,
        });

        const messenger = await createMessenger({
          leafSelector,
          processor: messageProcessor,
        });

        resolve({ messenger, messageProcessor });
      });
    }

    return messengerComponents;
  }

  const dependencies: ReturnType<typeof getChatbotBootstrapArgs> &
    LeafDependencies = {
    ...bootstrapArgs,
    facebookClient,
    env,
    getAsyncDependencies,
    telegramClient,
    webhookTimeout,
  };

  const router = express.Router();

  if (env === "local") {
    /** Use rate limitter for ngrok */
    router.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  router.use(express.json());
  router.use(ContextRoute(dependencies));
  router.use(WebhookRoute(dependencies));
  return { chatbotDependencies: dependencies, chatbotRouter: router };
}
