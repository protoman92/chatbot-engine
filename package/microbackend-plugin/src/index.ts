import { IMicrobackendPluginDefaultOptions } from "@microbackend/plugin-core";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {
  readonly enableFacebookMessenger?: boolean;
  readonly enableTelegramMessenger?: boolean;
}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
  }
}
