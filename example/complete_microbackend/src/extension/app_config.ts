import { MicrobackendAppConfig } from "@microbackend/plugin-core";

export default class CommonConfig extends MicrobackendAppConfig {
  get config(): MicrobackendAppConfig["config"] {
    return {
      chatbotEngine: {
        messenger: {
          facebook: {
            client: {
              apiVersion: "v1",
              pageToken: "placeholder",
              verifyToken: "placeholder",
            },
            isEnabled: true,
          },
          telegram: {
            client: { authToken: process.env["TELEGRAM_AUTH_TOKEN"] },
            isEnabled: true,
          },
        },
      },
    };
  }
}
