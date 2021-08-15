import {
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
  readonly env: string;
  readonly facebookClient: FacebookClient;
  readonly telegramClient: TelegramClient;
  readonly webhookTimeout: number;
  getAsyncDependencies(): Promise<DefaultAsynchronousDependencies<Context>>;
}
