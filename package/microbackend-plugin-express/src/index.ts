import {
  AmbiguousPlatform,
  Branch,
  FacebookConfig,
  TelegramConfig,
} from "@haipham/chatbot-engine-core";
import {
  IMicrobackendPluginDefaultOptions,
  IMicrobackendRequest,
} from "@microbackend/plugin-core";
import "@microbackend/plugin-express";
import { AsyncOrSync } from "ts-essentials";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
  }

  interface IMicrobackendConfig {
    readonly chatbotEngine: Readonly<{
      facebook: Readonly<{
        client: FacebookConfig;
        isEnabled: boolean;
        /**
         * This route handles the webhook challenge for Facebook messenger.
         * If not provided, defaults to /webhook/facebook.
         */
        webhookChallengeRoute?: string;
      }>;
      telegram: Readonly<{ client: TelegramConfig; isEnabled: boolean }>;
      /**
       * Since we must respond to POST calls from service providers with 200,
       * when errors happen, we will implicitly handle them with this callback.
       */
      onWebhookError?: (
        args: Readonly<{
          error: Error;
          payload: unknown;
          platform: AmbiguousPlatform;
        }>
      ) => AsyncOrSync<void>;
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
       * repeatedly called again.
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

  abstract get branch(): IMicrobackendBranch["branch"];
}
