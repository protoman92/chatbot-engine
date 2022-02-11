import {
  BaseMessageProcessor,
  Branch,
  ContextDAO,
  ErrorLeafConfig,
  FacebookClient,
  FacebookConfig,
  FacebookMessageProcessorMiddleware,
  LeafSelector,
  MessageProcessorMiddleware,
  Messenger,
  TelegramClient,
  TelegramConfig,
  TelegramMessageProcessorMiddleware,
} from "@haipham/chatbot-engine-core";
import {
  IMicrobackendApp,
  IMicrobackendPluginDefaultOptions,
  IMicrobackendRequest,
} from "@microbackend/plugin-core";
import "@microbackend/plugin-express";
import { AsyncOrSync } from "ts-essentials";
export * from "./utils";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {}

export interface IMicrobackendFacebookConfig {
  readonly client: FacebookConfig;
  /** If true, create and register the Facebook message processor. */
  readonly isEnabled: boolean;
  /** Middlewares to apply to the Facebook message processor. */
  readonly middlewares: (
    | MessageProcessorMiddleware
    | FacebookMessageProcessorMiddleware
  )[];
  /**
   * This route handles the webhook challenge for Facebook message processor.
   * If not provided, defaults to /webhook/facebook.
   */
  readonly webhookChallengeRoute?: string;
}

export interface IMicrobackendTelegramConfig {
  readonly client: TelegramConfig;
  /** If true, create and register the Telegram message processor. */
  readonly isEnabled: boolean;
  /** Middlewares to apply to the Telegram message processor. */
  readonly middlewares: (
    | MessageProcessorMiddleware
    | TelegramMessageProcessorMiddleware
  )[];
}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
  }

  interface IMicrobackendApp {
    readonly chatbotEngine: Readonly<{
      readonly contextDAO: ContextDAO;
      readonly facebookClient: FacebookClient;
      readonly telegramClient: TelegramClient;
    }>;
  }

  interface IMicrobackendRequest {
    readonly chatbotEngine: Readonly<{
      branches: Promise<Branch>;
      callbacks: IMicrobackendConfig["chatbotEngine"]["callbacks"];
      leafSelector: Promise<LeafSelector>;
      messageProcessor: Promise<BaseMessageProcessor>;
      messenger: Promise<Messenger>;
    }>;
  }

  interface IMicrobackendConfig {
    readonly chatbotEngine: Readonly<{
      facebook: IMicrobackendFacebookConfig;
      telegram: IMicrobackendTelegramConfig;
      callbacks: Readonly<{
        /**
         * This callback will be invoked in 2 cases:
         * - When there is an error thrown by the leaf that is handling the
         *   webhook payload.
         * - When there is an error with the process of handling a webhook
         *   payload (e.g. during parsing request, sending response etc) that
         *   is not related to leaf operations. Since we must respond to POST
         *   calls from service providers with 200, when errors happen, we will
         *   implicitly handle them with this callback.
         * The error details will differ in each situation, in terms of
         * granularity.
         */
        onError?: (
          req: IMicrobackendRequest,
          error: Error
        ) => AsyncOrSync<void>;
      }>;
      /**
       * The context DAO instance to use for all message processors.
       * If not provided, defaults to the in-memory context DAO.
       */
      contextDAO: ContextDAO;
      /**
       * When an error happens during leaf operations, we might want to catch
       * it and show an error message to the user (e.g. something went wrong)
       * instead of escaping silently.
       * If this function is not provided, the original error message will be
       * shown to the user.
       */
      formatLeafError: ErrorLeafConfig["formatErrorMessage"];
      /**
       * This route handles the webhook payload from all service providers. The
       * actual platform-specific logic happens at the messenger level. It
       * should be publicly available so that the service providers can call it
       * with POST when new messages arrive.
       * It must contain a route param for platform. If not provided, defaults
       * to /webhook/:platform.
       */
      webhookHandlerRoute?: string;
      /**
       * If we don't specify a timeout for Telegram, the webhook will be
       * repeatedly called again. If not provided, defaults to 20 seconds.
       */
      webhookTimeoutMs?: number;
    }>;
  }
}

declare module "@haipham/chatbot-engine-core" {
  interface ChatbotContext {}
}

export interface IMicrobackendBranchArgs {
  readonly request: IMicrobackendRequest;
}

export interface IMicrobackendBranch {
  readonly branch: AsyncOrSync<Branch>;
}

export type IMicrobackendBranchCreator = (
  args: IMicrobackendBranchArgs
) => IMicrobackendBranch;

export abstract class MicrobackendBranch implements IMicrobackendBranch {
  constructor(protected args: IMicrobackendBranchArgs) {}

  get app(): IMicrobackendApp {
    return this.args.request.app;
  }

  get facebookClient(): FacebookClient {
    return this.app.chatbotEngine.facebookClient;
  }

  get telegramClient(): TelegramClient {
    return this.app.chatbotEngine.telegramClient;
  }

  abstract get branch(): IMicrobackendBranch["branch"];
}
