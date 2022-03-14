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
        messenger: { facebook: {}, telegram: {} },
      },
    };
  }
}
