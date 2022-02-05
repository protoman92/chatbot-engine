import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class CommonConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {
      chatbotEngine: {
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
        callbacks: {
          onError: (...[, error]) => {
            console.error("Error:", error);
          },
        },
      },
    };
  }
}
