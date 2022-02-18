import { MicrobackendAppConfig } from "@microbackend/plugin-core";

export default class DefaultConfig extends MicrobackendAppConfig {
  get config(): MicrobackendAppConfig["config"] {
    return {
      chatbotEngine: {
        messenger: {
          facebook: { client: {}, isEnabled: false },
          telegram: { client: {}, isEnabled: false },
        },
      },
    };
  }
}
