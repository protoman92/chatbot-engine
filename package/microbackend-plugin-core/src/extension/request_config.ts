import { createDefaultInMemoryContextDAO } from "@haipham/chatbot-engine-core";
import { MicrobackendRequestConfig } from "@microbackend/plugin-core";

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
          facebook: { middlewares: [] },
          telegram: { middlewares: [] },
        },
      },
    };
  }
}
