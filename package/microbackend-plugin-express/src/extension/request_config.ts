import { MicrobackendRequestConfig } from "@microbackend/plugin-core";
import { DEFAULT_WEBHOOK_TIMEOUT_MS } from "..";

export default class DefaultConfig extends MicrobackendRequestConfig {
  get config(): MicrobackendRequestConfig["config"] {
    return {
      chatbotEngineExpress: {
        webhook: { timeoutMs: DEFAULT_WEBHOOK_TIMEOUT_MS },
      },
    };
  }
}
