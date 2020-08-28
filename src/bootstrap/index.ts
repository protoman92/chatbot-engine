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
  AmbiguousRequest,
  BaseMessageProcessor,
  Branch,
  ContextDAO,
  ErrorLeafConfig,
  FacebookClient,
  FacebookUser,
  LeafSelector,
  MessageProcessorMiddleware,
  Messenger,
  TelegramClient,
  TelegramUser,
} from "../type";
import { DefaultLeafResolverArgs, MessengerComponents } from "./interface";
import ContextRoute from "./route/context_route";
import WebhookRoute from "./route/webhook_route";

type ChatbotBootstrapArgs<
  Context extends Readonly<{ user?: TargetUser }>,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>,
  TargetUser
> = LeafResolverArgs &
  Readonly<{
    app: express.Application;
    commonMessageProcessorMiddlewares?: readonly MessageProcessorMiddleware<
      Context
    >[];
    contextDAO: ContextDAO<Context>;
    saveUser: (user: FacebookUser | TelegramUser) => Promise<TargetUser>;
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
>(args: ChatbotBootstrapArgs<Context, LeafResolverArgs, TargetUser>) {
  const {
    app,
    commonMessageProcessorMiddlewares = [],
    contextDAO,
    saveUser,
  } = args;

  const { NODE_ENV: env = "" } = process.env;
  let messageProcessor: BaseMessageProcessor<Context>;
  let facebookClient: FacebookClient;
  let telegramClient: TelegramClient;
  let messenger: Messenger;

  const resolverArgs = {
    ...((args as unknown) as LeafResolverArgs),
    env,
    getMessengerComponents,
  };

  async function getMessengerComponents(): Promise<
    MessengerComponents<Context>
  > {
    if (messenger == null || facebookClient == null || telegramClient == null) {
      facebookClient = await createFacebookClient();
      telegramClient = await createTelegramClient();

      const newLeafSelector = async () => {
        switch (args.leafSelectorType) {
          case "custom":
            const leafSelector = await args.createLeafSelector(resolverArgs);

            return await createTransformChain()
              .forContextOfType<Context>()
              .transform(leafSelector);

          case "default":
            const witClient = await createWitClient();
            const branches = await args.createBranches(resolverArgs);

            return await createTransformChain()
              .forContextOfType<Context>()
              .pipe(retryWithWit(witClient))
              .pipe(catchAll((request) => args.onLeafCatchAll(request)))
              .pipe(
                catchError(
                  await createDefaultErrorLeaf({
                    formatErrorMessage: args.formatErrorMessage,
                    trackError: args.onLeafError,
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
            await args.onSetTypingError({ error, platform: "facebook" });
          },
        }),
        saveFacebookUser(contextDAO, facebookClient, async (facebookUser) => {
          const user = await saveUser(facebookUser);

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
          const user = await saveUser(telegramUser);

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

  app.use(express.json());

  if (env === "local") {
    /** Use rate limitter for ngrok */
    app.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  app.use(ContextRoute(resolverArgs));
  app.use(WebhookRoute(resolverArgs));
}
