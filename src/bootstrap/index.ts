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
  FacebookUser,
  LeafSelector,
  Messenger,
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
  readonly contextDAO: ContextDAO<Context>;
  createLeafSelector(
    args: LeafResolverArgs & DefaultLeafResolverArgs<Context>
  ): Promise<LeafSelector<Context>>;
  handleError(error: Error): Promise<void>;
  saveUser(user: FacebookUser | TelegramUser): Promise<TargetUser>;
}

export default async function bootstrapChatbotServer<
  Context extends Readonly<{ user?: TargetUser }>,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>,
  TargetUser
>({
  app,
  contextDAO,
  createLeafSelector,
  saveUser,
  ...args
}: ChatbotBootstrapArgs<Context, LeafResolverArgs, TargetUser>) {
  const { NODE_ENV = "" } = process.env;
  const env = NODE_ENV;
  const facebookClient = await createFacebookClient();
  const telegramClient = await createTelegramClient();
  let messageProcessor: BaseMessageProcessor<Context>;
  let messenger: Messenger;

  const resolverArgs = {
    ...((args as unknown) as LeafResolverArgs),
    env,
    getMessengerComponents,
  };

  async function getMessengerComponents(): Promise<
    MessengerComponents<Context>
  > {
    if (messenger == null) {
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
        })
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
        })
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
    };
  }

  app.use(express.json());

  if (NODE_ENV === "local") {
    /** Use rate limitter for ngrok */
    app.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  app.get("/", async (...[, res]) => res.json({ message: "Welcome!" }));
  app.use(ContextRoute(resolverArgs));
  app.use(WebhookRoute(resolverArgs));
}
