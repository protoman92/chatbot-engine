import {
  BaseMessageProcessor,
  ContextDAO,
  FacebookClient,
  Messenger,
  TelegramClient,
} from "../../type";

export interface MessengerComponents<Context> {
  readonly contextDAO: ContextDAO<Context>;
  readonly facebookClient: FacebookClient;
  readonly messageProcessor: BaseMessageProcessor<Context>;
  readonly messenger: Messenger;
  readonly telegramClient: TelegramClient;
}

export interface DefaultLeafResolverArgs<Context>
  extends Pick<
    MessengerComponents<Context>,
    "facebookClient" | "telegramClient"
  > {
  readonly env: string;
  getMessengerComponents(): Promise<MessengerComponents<Context>>;
}
