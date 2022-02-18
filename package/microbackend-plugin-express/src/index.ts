import "@microbackend/plugin-chatbot-engine-core";
import { IMicrobackendPluginDefaultOptions } from "@microbackend/plugin-core";
import "@microbackend/plugin-express";
import { AsyncOrSync } from "ts-essentials";
import { WebhookHandlingError } from "./utils";
export * from "./utils";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine-express"]: IPluginOptions;
  }

  interface IMicrobackendAppConfig {
    readonly chatbotEngineExpress: Readonly<{
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
    readonly chatbotEngineExpress: Readonly<{
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
