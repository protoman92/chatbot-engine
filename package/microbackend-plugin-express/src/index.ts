import {
  Branch,
  ErrorLeafConfig,
  FacebookConfig,
  TelegramConfig,
} from "@haipham/chatbot-engine-core";
import {
  IMicrobackendPluginDefaultOptions,
  IMicrobackendRequest,
} from "@microbackend/plugin-core";
import "@microbackend/plugin-express";
import { AsyncOrSync } from "ts-essentials";
export { LeafHandlingError, WebhookHandlingError } from "./utils";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {}

export interface IMicrobackendFacebookConfig {
  readonly client: FacebookConfig;
  readonly isEnabled: boolean;
  /**
   * This route handles the webhook challenge for Facebook messenger.
   * If not provided, defaults to /webhook/facebook.
   */
  readonly webhookChallengeRoute?: string;
}

export interface IMicrobackendTelegramConfig {
  readonly client: TelegramConfig;
  readonly isEnabled: boolean;
}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
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
