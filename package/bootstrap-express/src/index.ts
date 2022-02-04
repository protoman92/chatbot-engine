import {
  AmbiguousGenericRequest,
  Branch,
  catchAll,
  catchError,
  ContextDAO,
  createCrossPlatformMessageProcessor,
  createDefaultErrorLeaf,
  createDefaultFacebookClient,
  createDefaultTelegramClient,
  createFacebookMessageProcessor,
  createLeafSelector,
  createMessenger,
  createTelegramMessageProcessor,
  createTransformChain,
  defaultWitClient as createWitClient,
  ErrorLeafConfig,
  FacebookClient,
  FacebookMessageProcessorMiddleware,
  LeafSelector,
  MessageProcessorMiddleware,
  retryWithWit,
  TelegramClient,
  TelegramMessageProcessorMiddleware,
} from "@haipham/chatbot-engine-core";
import express from "express";
import rateLimitter from "express-rate-limit";
import { StrictOmit } from "ts-essentials";
import {
  DefaultAsynchronousDependencies,
  DefaultLeafDependencies,
  OnWebhookErrorHandler,
} from "./interface";
import createCaptureGenericResponseMiddleware from "./middleware/capture_generic_response";
import ContextRoute from "./route/bootstrap_context_route";
import WebhookRoute from "./route/bootstrap_webhook_route";
export * from "./interface";

export type ChatbotProjectDependencies<
  LeafDependencies extends DefaultLeafDependencies
> = Omit<LeafDependencies, keyof DefaultLeafDependencies> &
  Readonly<{
    contextDAO: ContextDAO;
    messageProcessorMiddlewares?: Readonly<{
      facebook?: readonly (
        | MessageProcessorMiddleware
        | FacebookMessageProcessorMiddleware
      )[];
      telegram?: readonly (
        | MessageProcessorMiddleware
        | TelegramMessageProcessorMiddleware
      )[];
    }>;
    onWebhookError: OnWebhookErrorHandler;
  }> &
  (
    | {
        createLeafSelector: (args: LeafDependencies) => Promise<LeafSelector>;
        leafSelectorType: "custom";
      }
    | {
        createBranches: (args: LeafDependencies) => Promise<Branch>;
        formatErrorMessage: ErrorLeafConfig["formatErrorMessage"];
        leafSelectorType: "default";
        onLeafCatchAll: (request: AmbiguousGenericRequest) => Promise<void>;
        onLeafError?: NonNullable<ErrorLeafConfig["trackError"]>;
      }
  );

export default async function createChatbotRouter<
  LeafDependencies extends DefaultLeafDependencies
>({
  env,
  facebookClient = createDefaultFacebookClient(),
  getChatbotProjectDependencies,
  telegramClient = createDefaultTelegramClient({ defaultParseMode: "html" }),
  webhookTimeout,
}: Readonly<{
  env: string;
  facebookClient?: FacebookClient;
  getChatbotProjectDependencies: (
    args: StrictOmit<DefaultLeafDependencies, "contextDAO">
  ) => Promise<ChatbotProjectDependencies<LeafDependencies>>;
  /**
   * If we don't specify a timeout, the webhook will be repeatedly called
   * again. Need to check for why that's the case, but do not hog the entire
   * bot.
   */
  telegramClient?: TelegramClient;
  webhookTimeout: number;
}>) {
  const projectDeps = await getChatbotProjectDependencies({
    facebookClient,
    getAsyncDependencies,
    telegramClient,
    webhookTimeout,
  });

  let messengerComponents: Promise<DefaultAsynchronousDependencies> | undefined;

  function getAsyncDependencies() {
    if (messengerComponents == null) {
      messengerComponents = new Promise(async (resolve) => {
        let leafSelector: LeafSelector;

        switch (projectDeps.leafSelectorType) {
          case "custom": {
            leafSelector = await createTransformChain().transform(
              await projectDeps.createLeafSelector(dependencies)
            );

            break;
          }

          case "default": {
            const witClient = await createWitClient();
            const branches = await projectDeps.createBranches(dependencies);

            leafSelector = await createTransformChain()
              .pipe(retryWithWit(witClient))
              .pipe(catchAll(projectDeps.onLeafCatchAll))
              .pipe(
                catchError(
                  await createDefaultErrorLeaf({
                    formatErrorMessage: projectDeps.formatErrorMessage,
                    trackError: projectDeps.onLeafError,
                  })
                )
              )
              .transform(createLeafSelector(branches));
          }
        }

        const facebookProcessor = await createFacebookMessageProcessor(
          { leafSelector, client: facebookClient },
          ...(projectDeps.messageProcessorMiddlewares?.facebook ?? []),
          createCaptureGenericResponseMiddleware()
        );

        const telegramProcessor = await createTelegramMessageProcessor(
          { leafSelector, client: telegramClient },
          ...(projectDeps?.messageProcessorMiddlewares?.telegram ?? []),
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

  const dependencies = ({
    ...projectDeps,
    facebookClient,
    env,
    getAsyncDependencies,
    telegramClient,
    webhookTimeout,
  } as unknown) as LeafDependencies;

  const router = express.Router();

  if (env === "local") {
    /** Use rate limitter for ngrok */
    router.use(rateLimitter({ max: 15, windowMs: 1 * 60 * 1000 }));
  }

  router.use(express.json());
  router.use(ContextRoute(dependencies));

  router.use(
    WebhookRoute({
      ...dependencies,
      onWebhookError: projectDeps.onWebhookError,
    })
  );

  return { chatbotDependencies: dependencies, chatbotRouter: router };
}
