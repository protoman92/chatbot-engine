import { MicrobackendAppConfig } from "@microbackend/plugin-core";

export default class CommonConfig extends MicrobackendAppConfig {
  get config(): MicrobackendAppConfig["config"] {
    return {
      chatbotEngine: {
        messenger: {
          facebook: { isEnabled: true },
          telegram: { isEnabled: true },
        },
      },
    };
  }
}
