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
} from "./feature-switch";

declare module "@microbackend/plugin-core" {
  interface IMicrobackendApp {
    readonly chatbot: Readonly<{
      facebookClient?: FacebookClient;
      telegramClient?: TelegramClient;
    }>;
  }
}

export default {
  get chatbot(): IMicrobackendApp["chatbot"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendApp,
      "chatbot",
      () => {
        const helpers = createPluginHelpers(PLUGIN_NAME);
        const chatbot = {} as IMicrobackendApp["chatbot"];

        initializeOnce(chatbot, "facebookClient", () => {
          if (!enableFacebookMessenger) {
            throw helpers.createError(
              `enableFacebookMessenger is currently false, please make sure`,
              `the correct flag has been supplied to the plugin options and`,
              `the appropriate Facebook messenger configuration is available`,
              `in app.config`
            );
          }

          return createDefaultFacebookClient();
        });

        initializeOnce(chatbot, "telegramClient", () => {
          if (!enableTelegramMessenger) {
            throw helpers.createError(
              `enableTelegramMessenger is currently false, please make sure`,
              `the correct flag has been supplied to the plugin options and`,
              `the appropriate Telegram messenger configuration is available`,
              `in app.config`
            );
          }

          return createDefaultTelegramClient({ defaultParseMode: "html" });
        });

        return chatbot;
      }
    );
  },
};
