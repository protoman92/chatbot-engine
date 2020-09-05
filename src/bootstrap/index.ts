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
  BaseMessageProcessor,
  Branch,
  ContextDAO,
  ErrorLeafConfig,
  LeafSelector,
  MessageProcessorMiddleware,
  Messenger,
} from "../type";
import { DefaultLeafDependencies, MessengerComponents } from "./interface";
import createCaptureGenericResponseMiddleware from "./middleware/capture_generic_response";
import ContextRoute from "./route/context_route";
import WebhookRoute from "./route/webhook_route";

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

export default function bootstrapChatbotServer<
  Context,
  LeafDependencies extends DefaultLeafDependencies<Context>
>({
  app,
  bootstrapAfterRoutes,
  bootstrapBeforeRoutes,
  getChatbotBootstrapArgs,
  webhookTimeout,
}: Readonly<{
  app: express.Application;
  bootstrapBeforeRoutes?: (args: LeafDependencies) => void;
  bootstrapAfterRoutes?: (args: LeafDependencies) => void;
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
}>): void {
  async function getMessengerComponents(): Promise<
    MessengerComponents<Context>
  > {
    if (messageProcessor == null || messenger == null) {
      const newLeafSelector = async () => {
        switch (bootstrapArgs.leafSelectorType) {
          case "custom":
            const leafSelector = await bootstrapArgs.createLeafSelector(
              resolverArgs
            );

            return createTransformChain()
              .forContextOfType<Context>()
              .transform(leafSelector);

          case "default":
            const witClient = await createWitClient();
            const branches = await bootstrapArgs.createBranches(resolverArgs);

            return createTransformChain()
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
      };

      const leafSelector = await newLeafSelector();

      const facebookProcessor = await createFacebookMessageProcessor(
        { leafSelector, client: facebookClient },
        ...facebookMessageProcessorMiddlewares,
        createCaptureGenericResponseMiddleware()
      );

      const telegramProcessor = await createTelegramMessageProcessor(
        { leafSelector, client: telegramClient },
        ...telegramMessageProcessorMiddlewares,
        createCaptureGenericResponseMiddleware()
      );

      messageProcessor = createCrossPlatformMessageProcessor({
        facebook: facebookProcessor,
        telegram: telegramProcessor,
      });

      messenger = await createMessenger({
        leafSelector,
        processor: messageProcessor,
      });
    }

    return {
      contextDAO,
      facebookClient,
      messageProcessor,
      messenger,
      telegramClient,
    };
  }

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

  const {
    contextDAO,
    facebookMessageProcessorMiddlewares = [],
    telegramMessageProcessorMiddlewares = [],
  } = bootstrapArgs;

  let messageProcessor: BaseMessageProcessor<Context>;
  let messenger: Messenger;

  const resolverArgs = {
    ...bootstrapArgs,
    env,
    getMessengerComponents,
  } as ReturnType<typeof getChatbotBootstrapArgs> & LeafDependencies;

  if (bootstrapBeforeRoutes != null) bootstrapBeforeRoutes(resolverArgs);
  const router = express.Router();

  if (env === "local") {
    /** Use rate limitter for ngrok */
    router.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  router.use(express.json());
  router.use(ContextRoute(resolverArgs));
  router.use(WebhookRoute(resolverArgs));
  app.use(router);
  if (bootstrapAfterRoutes != null) bootstrapAfterRoutes(resolverArgs);
}
