import { MicrobackendAppConfig } from "@microbackend/plugin-core";
import {
  DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE,
  DEFAULT_WEBHOOK_HANDLER_ROUTE,
} from "..";

export default class DefaultConfig extends MicrobackendAppConfig {
  get config(): MicrobackendAppConfig["config"] {
    return {
      chatbotEngineExpress: {
        webhook: {
          facebook: {
            challengeRoute: DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE,
          },
          handlerRoute: DEFAULT_WEBHOOK_HANDLER_ROUTE,
        },
      },
    };
  }
}
