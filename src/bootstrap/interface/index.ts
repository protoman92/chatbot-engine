import {
  BaseMessageProcessor,
  ContextDAO,
  FacebookClient,
  Messenger,
} from "../../type";

export interface MessengerComponents<Context> {
  readonly contextDAO: ContextDAO<Context>;
  readonly facebookClient: FacebookClient;
  readonly messageProcessor: BaseMessageProcessor<Context>;
  readonly messenger: Messenger;
}

export interface DefaultLeafResolverArgs<Context> {
  readonly env: string;
  getMessengerComponents(): Promise<MessengerComponents<Context>>;
  handleError(error: Error): Promise<void>;
}
