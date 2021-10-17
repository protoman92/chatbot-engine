import {
  AmbiguousPlatform,
  BaseMessageProcessor,
  ContextDAO,
  FacebookClient,
  Messenger,
  TelegramClient,
} from "../../type";

export interface DefaultAsynchronousDependencies<Context> {
  readonly messageProcessor: BaseMessageProcessor<Context>;
  readonly messenger: Messenger;
}

export interface DefaultLeafDependencies<Context> {
  readonly contextDAO: ContextDAO<Context>;
  readonly facebookClient: FacebookClient;
  readonly telegramClient: TelegramClient;
  readonly webhookTimeout: number;
  getAsyncDependencies(): Promise<DefaultAsynchronousDependencies<Context>>;
}

export type OnWebhookErrorHandler = (
  args: Readonly<{
    error: Error;
    payload: unknown;
    platform: AmbiguousPlatform;
  }>
) => Promise<void>;
