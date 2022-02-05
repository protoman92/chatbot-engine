import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class CommonConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {
      chatbotEngine: {
        facebook: { isEnabled: true },
        telegram: {
          client: { authToken: process.env["TELEGRAM_AUTH_TOKEN"] },
          isEnabled: true,
        },
      },
    };
  }
}
