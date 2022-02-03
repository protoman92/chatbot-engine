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
    readonly facebookClient: FacebookClient;
    readonly telegramClient: TelegramClient;
  }
}

export default {
  get facebookClient(): IMicrobackendApp["facebookClient"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendApp,
      "facebookClient",
      () => {
        const helpers = createPluginHelpers(PLUGIN_NAME);

        if (!enableFacebookMessenger) {
          throw helpers.createError(
            `enableFacebookMessenger is currently false, please make sure`,
            `the correct flag has been supplied to the plugin options and`,
            `the appropriate Facebook messenger configuration is available`,
            `in app.config`
          );
        }

        return createDefaultFacebookClient();
      }
    );
  },
  get telegramClient(): IMicrobackendApp["telegramClient"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendApp,
      "telegramClient",
      () => {
        const helpers = createPluginHelpers(PLUGIN_NAME);
        if (!enableTelegramMessenger) {
          throw helpers.createError(
            `enableTelegramMessenger is currently false, please make sure`,
            `the correct flag has been supplied to the plugin options and`,
            `the appropriate Telegram messenger configuration is available`,
            `in app.config`
          );
        }

        return createDefaultTelegramClient({ defaultParseMode: "html" });
      }
    );
  },
};
