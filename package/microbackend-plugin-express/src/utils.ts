import { AmbiguousPlatform } from "@haipham/chatbot-engine-core";

export const DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE = "/webhook/facebook";
export const DEFAULT_WEBHOOK_HANDLER_ROUTE = "/webhook/:platform";
export const DEFAULT_WEBHOOK_TIMEOUT_MS = 20 * 1000;
export const PLUGIN_NAME = "@microbackend/plugin-chatbot-engine-express";

export class WebhookHandlingError extends Error {
  constructor(
    error: Error,
    public payload: unknown,
    public targetPlatform: AmbiguousPlatform
  ) {
    super(error.message);
    this.stack = error.stack;
  }
}
