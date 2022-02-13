import {
  createFacebookClient,
  createTelegramClient,
  defaultAxiosClient,
  FacebookConfig,
  TelegramConfig,
  _TelegramRawResponse,
} from "@haipham/chatbot-engine-core";
import { createPluginHelpers } from "@microbackend/common-utils";
import { IMicrobackendApp, initializeOnce } from "@microbackend/plugin-core";
import joi, { ObjectSchema, StrictSchemaMap } from "joi";
import { IMicrobackendFacebookConfig, IMicrobackendTelegramConfig } from "..";
import { PLUGIN_NAME } from "../utils";

export default {
  get chatbotEngine(): IMicrobackendApp["chatbotEngine"] {
    return initializeOnce(
      this as unknown as IMicrobackendApp,
      "chatbotEngine",
      (app) => {
        const helpers = createPluginHelpers(PLUGIN_NAME);

        return {
          get contextDAO(): IMicrobackendApp["chatbotEngine"]["contextDAO"] {
            return app.config.chatbotEngine.messenger.contextDAO;
          },
          get facebookClient(): IMicrobackendApp["chatbotEngine"]["facebookClient"] {
            return initializeOnce(
              this as IMicrobackendApp["chatbotEngine"],
              "facebookClient",
              () => {
                const { error: validationError } = joi
                  .object<IMicrobackendFacebookConfig, true>({
                    client: joi.object<FacebookConfig, true>({
                      apiVersion: joi.string().min(1).required(),
                      pageToken: joi.string().min(1).required(),
                      verifyToken: joi.string().min(1).required(),
                    }) as ObjectSchema<StrictSchemaMap<FacebookConfig>>,
                    isEnabled: joi
                      .boolean()
                      .required()
                      .equal(true)
                      .error(
                        new Error(
                          [
                            `Facebook messenger is not enabled, please make sure`,
                            `the appropriate Facebook messenger configuration`,
                            `is available in app.config.`,
                          ].join(" ")
                        )
                      ),
                    middlewares: joi.array().required(),
                  })
                  .validate(app.config.chatbotEngine.messenger.facebook);

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
                  .object<IMicrobackendTelegramConfig, true>({
                    client: joi.object<TelegramConfig, true>({
                      authToken: joi.string().min(1).required(),
                      defaultParseMode: joi
                        .string()
                        .valid(
                          ...Object.keys((): {
                            [K in _TelegramRawResponse.ParseMode]: boolean;
                          } => {
                            return { html: true, markdown: true };
                          })
                        )
                        .optional(),
                      defaultPaymentProviderToken: joi.string().min(1),
                    }) as ObjectSchema<StrictSchemaMap<TelegramConfig>>,
                    isEnabled: joi
                      .boolean()
                      .equal(true)
                      .required()
                      .error(
                        new Error(
                          [
                            `Telegram messenger is not enabled, please make`,
                            `sure the appropriate Telegram messenger`,
                            `configuration is available in app.config.`,
                          ].join(" ")
                        )
                      ),
                    middlewares: joi.array().required(),
                  })
                  .validate(app.config.chatbotEngine.messenger.telegram);

                if (validationError != null) {
                  throw helpers.createError(validationError.message);
                }

                return createTelegramClient(defaultAxiosClient, {
                  defaultParseMode: "html",
                  ...app.config.chatbotEngine.messenger.telegram.client,
                });
              }
            );
          },
        };
      }
    );
  },
};
