import { createDefaultInMemoryContextDAO } from "@haipham/chatbot-engine-core";
import { MicrobackendConfig } from "@microbackend/plugin-core";
import {
  DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE,
  DEFAULT_WEBHOOK_HANDLER_ROUTE,
  DEFAULT_WEBHOOK_TIMEOUT_MS,
} from "..";

export default class DefaultConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {
      chatbotEngine: {
        leaf: {
          formatErrorMessage: (error) => {
            return error.message;
          },
        },
        messenger: {
          contextDAO: createDefaultInMemoryContextDAO(),
          facebook: { client: {}, isEnabled: false, middlewares: [] },
          telegram: { client: {}, isEnabled: false, middlewares: [] },
        },
        webhook: {
          facebook: {
            challengeRoute: DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE,
          },
          handlerRoute: DEFAULT_WEBHOOK_HANDLER_ROUTE,
          timeoutMs: DEFAULT_WEBHOOK_TIMEOUT_MS,
        },
      },
    };
  }
}
