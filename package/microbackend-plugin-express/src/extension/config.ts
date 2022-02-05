import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class DefaultConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {
      chatbotEngine: {
        callbacks: {},
        facebook: { client: {}, isEnabled: false },
        telegram: { client: {}, isEnabled: false },
      },
    };
  }
}
