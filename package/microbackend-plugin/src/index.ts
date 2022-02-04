import {
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

export interface IPluginOptions extends IMicrobackendPluginDefaultOptions {
  readonly enableFacebookMessenger?: boolean;
  readonly enableTelegramMessenger?: boolean;
}

declare module "@microbackend/plugin-core" {
  interface IMicrobackendPluginRegistry {
    ["@microbackend/plugin-chatbot-engine"]: IPluginOptions;
  }

  interface IMicrobackendConfig {
    readonly chatbotEngine: Readonly<{
      facebook: Readonly<{ client: FacebookConfig }>;
      telegram: Readonly<{ client: TelegramConfig }>;
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

  abstract get branch(): AsyncOrSync<Branch>;
}
