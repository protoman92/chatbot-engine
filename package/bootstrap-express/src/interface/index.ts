import {
  AmbiguousPlatform,
  BaseMessageProcessor,
  ContextDAO,
  FacebookClient,
  Messenger,
  TelegramClient,
} from "@haipham/chatbot-engine-core";

export interface DefaultAsynchronousDependencies {
  readonly messageProcessor: BaseMessageProcessor;
  readonly messenger: Messenger;
}

export interface DefaultLeafDependencies {
  readonly contextDAO: ContextDAO;
  readonly facebookClient: FacebookClient;
  readonly telegramClient: TelegramClient;
  readonly webhookTimeout: number;
  getAsyncDependencies(): Promise<DefaultAsynchronousDependencies>;
}

export type OnWebhookErrorHandler = (
  args: Readonly<{
    error: Error;
    payload: unknown;
    platform: AmbiguousPlatform;
  }>
) => Promise<void>;
