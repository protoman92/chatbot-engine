import { createDefaultInMemoryContextDAO } from "@haipham/chatbot-engine-core";
import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class DefaultConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {
      chatbotEngine: {
        facebook: { client: {}, isEnabled: false, middlewares: [] },
        telegram: { client: {}, isEnabled: false, middlewares: [] },
        callbacks: {},
        contextDAO: createDefaultInMemoryContextDAO(),
        formatLeafError: (error) => {
          return error.message;
        },
      },
    };
  }
}
