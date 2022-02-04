import {
  createDefaultFacebookClient,
  createDefaultTelegramClient,
  FacebookClient,
  TelegramClient,
} from "@haipham/chatbot-engine-core";
import { createPluginHelpers } from "@microbackend/common-utils";
import { IMicrobackendApp, initializeOnce } from "@microbackend/plugin-core";
import { PLUGIN_NAME } from "../utils";
import {
  enableFacebookMessenger,
  enableTelegramMessenger,
} from "../feature_switch";

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
      () => {
        const helpers = createPluginHelpers(PLUGIN_NAME);

        return {
          get facebookClient(): IMicrobackendApp["chatbotEngine"]["facebookClient"] {
            return initializeOnce(
              this as IMicrobackendApp["chatbotEngine"],
              "facebookClient",
              () => {
                if (!enableFacebookMessenger) {
                  throw helpers.createError(
                    `enableFacebookMessenger is currently false, please make`,
                    `sure the correct flag has been supplied to the plugin`,
                    `options and the appropriate Facebook messenger`,
                    `configuration is available in app.config`
                  );
                }

                return createDefaultFacebookClient();
              }
            );
          },
          get telegramClient(): IMicrobackendApp["chatbotEngine"]["telegramClient"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendApp["chatbotEngine"],
              "telegramClient",
              () => {
                const helpers = createPluginHelpers(PLUGIN_NAME);
                if (!enableTelegramMessenger) {
                  throw helpers.createError(
                    `enableTelegramMessenger is currently false, please make`,
                    `sure the correct flag has been supplied to the plugin`,
                    `options and the appropriate Telegram messenger`,
                    `configuration is available in app.config`
                  );
                }

                return createDefaultTelegramClient({
                  defaultParseMode: "html",
                });
              }
            );
          },
        };
      }
    );
  },
};
