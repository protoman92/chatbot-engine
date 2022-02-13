import { createDefaultInMemoryContextDAO } from "@haipham/chatbot-engine-core";
import { MicrobackendRequestConfig } from "@microbackend/plugin-core";
import { DEFAULT_WEBHOOK_TIMEOUT_MS } from "..";

export default class DefaultConfig extends MicrobackendRequestConfig {
  get config(): MicrobackendRequestConfig["config"] {
    return {
      chatbotEngine: {
        contextDAO: createDefaultInMemoryContextDAO(),
        leaf: {
          formatErrorMessage: (error) => {
            return error.message;
          },
        },
        messenger: {
          facebook: { client: {}, middlewares: [] },
          telegram: { client: {}, middlewares: [] },
        },
        webhook: {
          timeoutMs: DEFAULT_WEBHOOK_TIMEOUT_MS,
        },
      },
    };
  }
}
