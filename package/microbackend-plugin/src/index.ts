import { IMicrobackendPluginDefaultOptions } from "@microbackend/plugin-core";
import "@microbackend/plugin-express";

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {
  readonly enableFacebookMessenger?: boolean;
  readonly enableTelegramMessenger?: boolean;
}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
  }
}

declare module "@haipham/chatbot-engine-core" {
  interface ChatbotContext {}
}
