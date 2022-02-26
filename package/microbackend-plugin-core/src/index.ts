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
import { AsyncOrSync } from "ts-essentials";
import { LeafHandlingError } from "./utils";
export * from "./utils";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine-core"]: IPluginOptions;
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
    }>;
  }
}

export interface IMicrobackendBranchArgs {
  readonly req: IMicrobackendRequest;
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
    return this.args.req.app;
  }

  get req(): IMicrobackendRequest {
    return this.args.req;
  }

  get facebookClient(): FacebookClient {
    return this.app.chatbotEngine.facebookClient;
  }

  get telegramClient(): TelegramClient {
    return this.app.chatbotEngine.telegramClient;
  }

  abstract get branch(): IMicrobackendBranch["branch"];
}
