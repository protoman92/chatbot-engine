import {
  createFacebookClient,
  createTelegramClient,
  defaultAxiosClient,
  FacebookClient,
  FacebookConfig,
  TelegramClient,
  TelegramConfig,
  _TelegramRawResponse,
} from "@haipham/chatbot-engine-core";
import { createPluginHelpers } from "@microbackend/common-utils";
import { IMicrobackendApp, initializeOnce } from "@microbackend/plugin-core";
import joi from "joi";
import { PLUGIN_NAME } from "../utils";

declare module "@microbackend/plugin-core" {
  interface IMicrobackendApp {
    readonly chatbotEngine: Readonly<{
      readonly facebookClient: FacebookClient;
      readonly telegramClient: TelegramClient;
    }>;
  }
}

export default {
  get chatbotEngine(): IMicrobackendApp["chatbotEngine"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendApp,
      "chatbotEngine",
      (app) => {
        const helpers = createPluginHelpers(PLUGIN_NAME);

        return {
          get facebookClient(): IMicrobackendApp["chatbotEngine"]["facebookClient"] {
            return initializeOnce(
              this as IMicrobackendApp["chatbotEngine"],
              "facebookClient",
              () => {
                const { error: validationError } = joi
                  .object({
                    config: joi.object<FacebookConfig, true>({
                      apiVersion: joi.string().required(),
                      pageToken: joi.string().required(),
                      verifyToken: joi.string().required(),
                    }),
                    isEnabled: joi
                      .boolean()
                      .equal(true)
                      .error(
                        new Error(
                          [
                            `Facebook messenger is not enabled, please make`,
                            `sure the appropriate Facebook messenger`,
                            `configuration is available in app.config.`,
                          ].join(" ")
                        )
                      ),
                  })
                  .validate({
                    config: app.config.chatbotEngine.facebook.client,
                    isEnabled: app.config.chatbotEngine.facebook.isEnabled,
                  });

                if (validationError != null) {
                  throw helpers.createError(validationError.message);
                }

                return createFacebookClient(
                  defaultAxiosClient,
                  app.config.chatbotEngine.facebook.client
                );
              }
            );
          },
          get telegramClient(): IMicrobackendApp["chatbotEngine"]["telegramClient"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendApp["chatbotEngine"],
              "telegramClient",
              () => {
                const { error: validationError } = joi
                  .object({
                    config: joi.object<TelegramConfig, true>({
                      authToken: joi.string().required(),
                      defaultParseMode: joi
                        .string()
                        .valid(
                          Object.keys((): {
                            [K in _TelegramRawResponse.ParseMode]: boolean;
                          } => {
                            return { html: true, markdown: true };
                          })
                        )
                        .optional(),
                      defaultPaymentProviderToken: joi.string().optional(),
                    }),
                    isEnabled: joi
                      .boolean()
                      .equal(true)
                      .error(
                        new Error(
                          [
                            `Telegram messenger is not enabled, please make`,
                            `sure the appropriate Telegram messenger`,
                            `configuration is available in app.config.`,
                          ].join(" ")
                        )
                      ),
                  })
                  .validate({
                    config: app.config.chatbotEngine.telegram.client,
                    isEnabled: app.config.chatbotEngine.telegram.isEnabled,
                  });

                if (validationError != null) {
                  throw helpers.createError(validationError.message);
                }

                return createTelegramClient(defaultAxiosClient, {
                  defaultParseMode: "html",
                  ...app.config.chatbotEngine.telegram.client,
                });
              }
            );
          },
        };
      }
    );
  },
};
