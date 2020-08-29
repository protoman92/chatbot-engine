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
  injectContextOnReceive,
  saveContextOnSend,
  saveFacebookUser,
  saveTelegramUser,
  setTypingIndicator,
} from "../messenger";
import {
  AmbiguousPlatform,
  AmbiguousRequest,
  BaseMessageProcessor,
  Branch,
  ContextDAO,
  ErrorLeafConfig,
  FacebookUser,
  LeafSelector,
  MessageProcessorMiddleware,
  Messenger,
  TelegramUser,
} from "../type";
import { DefaultLeafResolverArgs, MessengerComponents } from "./interface";
import ContextRoute from "./route/context_route";
import WebhookRoute from "./route/webhook_route";

export type ChatbotBootstrapArgs<
  Context extends Readonly<{ user?: TargetUser }>,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>,
  TargetUser
> = Omit<LeafResolverArgs, keyof DefaultLeafResolverArgs<Context>> &
  Readonly<{
    commonMessageProcessorMiddlewares?: readonly MessageProcessorMiddleware<
      Context
    >[];
    contextDAO: ContextDAO<Context>;
    onSetTypingError: (
      args: Readonly<{ error: Error; platform: AmbiguousPlatform }>
    ) => Promise<void>;
    onWebhookError: (
      args: Readonly<{
        error: Error;
        payload: unknown;
        platform: AmbiguousPlatform;
      }>
    ) => Promise<void>;
    saveUser: (
      args: Readonly<
        | { targetPlatform: "facebook"; facebookUser: FacebookUser }
        | { targetPlatform: "telegram"; telegramUser: TelegramUser }
      >
    ) => Promise<TargetUser>;
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
  Context extends Readonly<{ user?: TargetUser }>,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>,
  TargetUser
>({
  app,
  getBootstrapArgs,
}: Readonly<{
  app: express.Application;
  getBootstrapArgs: (
    args: DefaultLeafResolverArgs<Context> &
      Pick<MessengerComponents<Context>, "facebookClient" | "telegramClient">
  ) => ChatbotBootstrapArgs<Context, LeafResolverArgs, TargetUser>;
}>): (bootstrap?: (args: LeafResolverArgs) => void) => void {
  async function getMessengerComponents(): Promise<
    MessengerComponents<Context>
  > {
    if (messenger == null) {
      const newLeafSelector = async () => {
        switch (bootstrapArgs.leafSelectorType) {
          case "custom":
            const leafSelector = await bootstrapArgs.createLeafSelector(
              resolverArgs
            );

            return await createTransformChain()
              .forContextOfType<Context>()
              .transform(leafSelector);

          case "default":
            const witClient = await createWitClient();
            const branches = await bootstrapArgs.createBranches(resolverArgs);

            return await createTransformChain()
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
        injectContextOnReceive(contextDAO),
        saveContextOnSend(contextDAO),
        setTypingIndicator({
          client: facebookClient,
          onSetTypingError: async (error) => {
            await bootstrapArgs.onSetTypingError({
              error,
              platform: "facebook",
            });
          },
        }),
        saveFacebookUser(contextDAO, facebookClient, async (facebookUser) => {
          const user = await saveUser({
            facebookUser,
            targetPlatform: "facebook",
          });

          return {
            additionalContext: { user } as Partial<Context>,
            targetUserID: `${facebookUser.id}`,
          };
        }),
        ...commonMessageProcessorMiddlewares
      );

      const telegramProcessor = await createTelegramMessageProcessor(
        { leafSelector, client: telegramClient },
        injectContextOnReceive(contextDAO),
        saveContextOnSend(contextDAO),
        setTypingIndicator({ client: telegramClient }),
        saveTelegramUser(contextDAO, async (telegramUser) => {
          const user = await saveUser({
            telegramUser,
            targetPlatform: "telegram",
          });

          return {
            additionalContext: { user } as Partial<Context>,
            telegramUserID: telegramUser.id,
          };
        }),
        ...commonMessageProcessorMiddlewares
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
    commonMessageProcessorMiddlewares = [],
    contextDAO,
    saveUser,
  } = bootstrapArgs;

  let messageProcessor: BaseMessageProcessor<Context>;
  let messenger: Messenger;

  const resolverArgs = {
    ...bootstrapArgs,
    env,
    getMessengerComponents,
  } as ReturnType<typeof getBootstrapArgs> & LeafResolverArgs;

  return function (bootstrap) {
    app.use(express.json());

    if (env === "local") {
      /** Use rate limitter for ngrok */
      app.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
    }

    app.use(ContextRoute(resolverArgs));
    app.use(WebhookRoute(resolverArgs));
    if (bootstrap != null) bootstrap(resolverArgs);
  };
}
