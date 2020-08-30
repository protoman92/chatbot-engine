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
import { DefaultLeafResolverArgs, MessengerComponents } from "./interface";
import ContextRoute from "./route/context_route";
import WebhookRoute from "./route/webhook_route";

export type ChatbotBootstrapArgs<
  Context,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>
> = Omit<LeafResolverArgs, keyof DefaultLeafResolverArgs<Context>> &
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
          args: LeafResolverArgs
        ) => Promise<LeafSelector<Context>>;
        leafSelectorType: "custom";
      }
    | {
        createBranches: (args: LeafResolverArgs) => Promise<Branch<Context>>;
        formatErrorMessage: ErrorLeafConfig["formatErrorMessage"];
        leafSelectorType: "default";
        onLeafCatchAll: (request: AmbiguousRequest<Context>) => Promise<void>;
        onLeafError?: NonNullable<ErrorLeafConfig["trackError"]>;
      }
  );

export default function bootstrapChatbotServer<
  Context,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>
>({
  app,
  bootstrapAfterRoutes,
  bootstrapBeforeRoutes,
  getBootstrapArgs,
}: Readonly<{
  app: express.Application;
  bootstrapBeforeRoutes?: (args: LeafResolverArgs) => void;
  bootstrapAfterRoutes?: (args: LeafResolverArgs) => void;
  getBootstrapArgs: (
    args: DefaultLeafResolverArgs<Context>
  ) => ChatbotBootstrapArgs<Context, LeafResolverArgs>;
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
        ...facebookMessageProcessorMiddlewares
      );

      const telegramProcessor = await createTelegramMessageProcessor(
        { leafSelector, client: telegramClient },
        ...telegramMessageProcessorMiddlewares
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

  const bootstrapArgs = getBootstrapArgs({
    env,
    facebookClient,
    getMessengerComponents,
    telegramClient,
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
  } as ReturnType<typeof getBootstrapArgs> & LeafResolverArgs;

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
