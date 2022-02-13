import { MicrobackendRequestConfig } from "@microbackend/plugin-core";

export default class CommonConfig extends MicrobackendRequestConfig {
  get config(): MicrobackendRequestConfig["config"] {
    return {
      chatbotEngine: {
        leaf: {
          onError: (error) => {
            console.error("Error:", error);
          },
        },
        messenger: {
          facebook: {
            client: {
              apiVersion: "v1",
              pageToken: "placeholder",
              verifyToken: "placeholder",
            },
          },
          telegram: {
            client: { authToken: process.env["TELEGRAM_AUTH_TOKEN"] },
          },
        },
        webhook: {
          onError: (error) => {
            console.error("Error:", error);
          },
        },
      },
    };
  }
}
