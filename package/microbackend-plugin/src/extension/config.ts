import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class DefaultConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {
      chatbotEngine: { facebook: { client: {} }, telegram: { client: {} } },
    };
  }
}
