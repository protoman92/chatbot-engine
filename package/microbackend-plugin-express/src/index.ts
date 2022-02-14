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
import { LeafHandlingError, WebhookHandlingError } from "./utils";
export * from "./utils";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
  }

  interface IMicrobackendApp {
    readonly chatbotEngine: Readonly<{
      facebookClient: FacebookClient;
      telegramClient: TelegramClient;
    }>;
  }

  interface IMicrobackendRequest {
    readonly chatbotEngine: Readonly<{
      contextDAO: ContextDAO;
      branches: Promise<Branch>;
      leafSelector: Promise<LeafSelector>;
      messageProcessor: Promise<BaseMessageProcessor>;
      messenger: Promise<Messenger>;
    }>;
  }

  interface IMicrobackendAppConfig {
    readonly chatbotEngine: Readonly<{
      messenger: Readonly<{
        facebook: Readonly<{
          client: FacebookConfig;
          /** If true, create and register the Facebook message processor. */
          isEnabled: boolean;
        }>;
        telegram: Readonly<{
          client: TelegramConfig;
          /** If true, create and register the Telegram message processor. */
          isEnabled: boolean;
        }>;
      }>;
      webhook: Readonly<{
        facebook: Readonly<{
          /**
           * This route handles the webhook challenge for Facebook message
           * processor. If not provided, defaults to /webhook/facebook.
           */
          readonly challengeRoute: string;
        }>;
        /**
         * This route handles the webhook payload from all service providers. The
         * actual platform-specific logic happens at the messenger level. It
         * should be publicly available so that the service providers can call it
         * with POST when new messages arrive.
         * It must contain a route param for platform. If not provided, defaults
         * to /webhook/:platform.
         */
        handlerRoute: string;
      }>;
    }>;
  }

  interface IMicrobackendRequestConfig {
    readonly chatbotEngine: Readonly<{
      /**
       * The context DAO instance to use for all message processors.
       * If not provided, defaults to the in-memory context DAO.
       */
      contextDAO: ContextDAO;
      leaf: Readonly<{
        /**
         * When an error happens during leaf operations, we might want to catch
         * it and show an error message to the user (e.g. something went wrong)
         * instead of escaping silently.
         * If this function is not provided, the original error message will be
         * shown to the user.
         */
        formatErrorMessage: ErrorLeafConfig["formatErrorMessage"];
        /**
         * This callback will be invoked when there is an error thrown by the
         * leaf that is handling the webhook payload.
         */
        onError?: (error: LeafHandlingError) => AsyncOrSync<void>;
      }>;
      messenger: Readonly<{
        facebook: Readonly<{
          /** Middlewares to apply to the Facebook message processor. */
          middlewares: (
            | MessageProcessorMiddleware
            | FacebookMessageProcessorMiddleware
          )[];
        }>;
        telegram: Readonly<{
          /** Middlewares to apply to the Telegram message processor. */
          middlewares: (
            | MessageProcessorMiddleware
            | TelegramMessageProcessorMiddleware
          )[];
        }>;
      }>;
      webhook: Readonly<{
        /**
         * This callback will be invoked when there is an error with the process
         * of handling a webhookpayload (e.g. during parsing request, sending
         * response etc) that is not related to leaf operations. Since we must
         * respond to POST calls from service providers with 200, when errors
         * happen, we will implicitly handle them with this callback.
         */
        onError?: (error: WebhookHandlingError) => AsyncOrSync<void>;
        /**
         * If we don't specify a timeout for Telegram, the webhook will be
         * repeatedly called again. If not provided, defaults to 20 seconds.
         */
        timeoutMs: number;
      }>;
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

  get request(): IMicrobackendRequest {
    return this.args.request;
  }

  get facebookClient(): FacebookClient {
    return this.app.chatbotEngine.facebookClient;
  }

  get telegramClient(): TelegramClient {
    return this.app.chatbotEngine.telegramClient;
  }

  abstract get branch(): IMicrobackendBranch["branch"];
}
