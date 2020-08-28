import express from "express";
import rateLimitter from "express-rate-limit";
import { createTransformChain } from "../content";
import {
  createCrossPlatformMessageProcessor,
  createFacebookMessageProcessor,
  createMessenger,
  createTelegramMessageProcessor,
  injectContextOnReceive,
  saveContextOnSend,
  saveFacebookUser,
  saveTelegramUser,
  setTypingIndicator,
} from "../messenger";
import createFacebookClient from "../messenger/facebook-client";
import createTelegramClient from "../messenger/telegram-client";
import {
  BaseMessageProcessor,
  ContextDAO,
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

interface ChatbotBootstrapArgs<
  Context extends Readonly<{ user?: TargetUser }>,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>,
  TargetUser
> {
  readonly app: express.Application;
  readonly commonMessageProcessorMiddlewares?: readonly MessageProcessorMiddleware<
    Context
  >[];
  readonly contextDAO: ContextDAO<Context>;
  createLeafSelector(
    args: LeafResolverArgs & DefaultLeafResolverArgs<Context>
  ): Promise<LeafSelector<Context>>;
  handleError(error: Error): Promise<void>;
  saveUser(user: FacebookUser | TelegramUser): Promise<TargetUser>;
}

export default function bootstrapChatbotServer<
  Context extends Readonly<{ user?: TargetUser }>,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>,
  TargetUser
>({
  app,
  commonMessageProcessorMiddlewares = [],
  contextDAO,
  createLeafSelector,
  saveUser,
  ...args
}: ChatbotBootstrapArgs<Context, LeafResolverArgs, TargetUser>) {
  const { NODE_ENV = "" } = process.env;
  const env = NODE_ENV;
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
        const leafSelector = await createLeafSelector(resolverArgs);

        return await createTransformChain()
          .forContextOfType<Context>()
          .transform(leafSelector);
      };

      const leafSelector = await newLeafSelector();

      const facebookProcessor = await createFacebookMessageProcessor(
        { leafSelector, client: facebookClient },
        injectContextOnReceive(contextDAO),
        saveContextOnSend(contextDAO),
        setTypingIndicator({
          client: facebookClient,
          onSetTypingError: (error) => args.handleError(error),
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

  if (NODE_ENV === "local") {
    /** Use rate limitter for ngrok */
    app.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  app.use(ContextRoute(resolverArgs));
  app.use(WebhookRoute(resolverArgs));
}
