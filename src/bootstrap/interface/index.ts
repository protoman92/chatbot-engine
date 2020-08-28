import {
  BaseMessageProcessor,
  ContextDAO,
  FacebookClient,
  Messenger,
  TelegramClient,
  AmbiguousPlatform,
} from "../../type";

export interface MessengerComponents<Context> {
  readonly contextDAO: ContextDAO<Context>;
  readonly facebookClient: FacebookClient;
  readonly messageProcessor: BaseMessageProcessor<Context>;
  readonly messenger: Messenger;
  readonly telegramClient: TelegramClient;
}

export interface DefaultLeafResolverArgs<Context> {
  readonly env: string;
  getMessengerComponents(): Promise<MessengerComponents<Context>>;

  onSetTypingError(
    args: Readonly<{ error: Error; platform: AmbiguousPlatform }>
  ): Promise<void>;

  onWebhookError(
    args: Readonly<{
      error: Error;
      payload: unknown;
      platform: AmbiguousPlatform;
    }>
  ): Promise<void>;
}
