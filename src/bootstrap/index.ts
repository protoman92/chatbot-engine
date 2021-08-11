import express from "express";
import rateLimitter from "express-rate-limit";
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
import { DefaultLeafDependencies, MessengerComponents } from "./interface";
import createCaptureGenericResponseMiddleware from "./middleware/capture_generic_response";
import ContextRoute from "./route/bootstrap_context_route";
import WebhookRoute from "./route/bootstrap_webhook_route";

export type ChatbotBootstrapArgs<
  Context,
  LeafDependencies extends DefaultLeafDependencies<Context>
> = Omit<LeafDependencies, keyof DefaultLeafDependencies<Context>> &
  Readonly<{
    contextDAO: ContextDAO<Context>;
    facebookMessageProcessorMiddlewares?: readonly MessageProcessorMiddleware<
      Context
    >[];
    onWebhookError: (
      args: Readonly<{
        error: Error;
        payload: unknown;
        platform: AmbiguousPlatform;
      }>
    ) => Promise<void>;
    telegramMessageProcessorMiddlewares?: readonly MessageProcessorMiddleware<
      Context
    >[];
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
    args: DefaultLeafDependencies<Context>
  ) => ChatbotBootstrapArgs<Context, LeafDependencies>;
  /**
   *
   * If we don't specify a timeout, the webhook will be repeatedly called
   * again. Need to check for why that's the case, but do not hog the entire
   * bot.
   */
  webhookTimeout: number;
}>): express.Router {
  const { NODE_ENV: env = "" } = process.env;
  const facebookClient = createFacebookClient();
  const telegramClient = createTelegramClient({ defaultParseMode: "html" });

  const bootstrapArgs = getChatbotBootstrapArgs({
    env,
    facebookClient,
    getMessengerComponents,
    telegramClient,
    webhookTimeout,
  });

  let messengerComponents: Promise<MessengerComponents<Context>> | undefined;

  function getMessengerComponents() {
    if (messengerComponents == null) {
      messengerComponents = new Promise(async (resolve) => {
        let leafSelector: LeafSelector<Context>;

        switch (bootstrapArgs.leafSelectorType) {
          case "custom": {
            const injectedleafSelector = await bootstrapArgs.createLeafSelector(
              resolverArgs
            );

            leafSelector = await createTransformChain()
              .forContextOfType<Context>()
              .transform(injectedleafSelector);

            break;
          }

          case "default": {
            const witClient = await createWitClient();
            const branches = await bootstrapArgs.createBranches(resolverArgs);

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
          ...(bootstrapArgs.facebookMessageProcessorMiddlewares ?? []),
          createCaptureGenericResponseMiddleware()
        );

        const telegramProcessor = await createTelegramMessageProcessor(
          { leafSelector, client: telegramClient },
          ...(bootstrapArgs.telegramMessageProcessorMiddlewares ?? []),
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

        resolve({
          facebookClient,
          messenger,
          messageProcessor,
          telegramClient,
          contextDAO: bootstrapArgs.contextDAO,
        });
      });
    }

    return messengerComponents;
  }

  const resolverArgs: ReturnType<typeof getChatbotBootstrapArgs> &
    LeafDependencies = {
    ...bootstrapArgs,
    facebookClient,
    env,
    getMessengerComponents,
    telegramClient,
    webhookTimeout,
  };

  const router = express.Router();

  if (env === "local") {
    /** Use rate limitter for ngrok */
    router.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  router.use(express.json());
  router.use(ContextRoute(resolverArgs));
  router.use(WebhookRoute(resolverArgs));
  return router;
}
