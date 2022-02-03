import {
  BaseMessageProcessor,
  createCrossPlatformMessageProcessor,
  createFacebookMessageProcessor,
  createMessenger,
  createTelegramMessageProcessor,
  FacebookMessageProcessor,
  LeafSelector,
  Messenger,
  TelegramMessageProcessor,
} from "@haipham/chatbot-engine-core";
import {
  IMicrobackendRequest,
  initializeOnce,
} from "@microbackend/plugin-core";
import {
  enableFacebookMessenger,
  enableTelegramMessenger,
} from "./feature-switch";

declare module "@microbackend/plugin-core" {
  interface IMicrobackendRequest {
    readonly leafSelector: LeafSelector;
    readonly messageProcessor: Promise<BaseMessageProcessor>;
    readonly messenger: Promise<Messenger>;
  }
}

export default {
  get leafSelector(): IMicrobackendRequest["leafSelector"] {
    throw new Error("Not implemented");
  },
  get messageProcessor(): IMicrobackendRequest["messageProcessor"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendRequest,
      "messageProcessor",
      async (req) => {
        let facebookProcessor: FacebookMessageProcessor | undefined;
        let telegramProcessor: TelegramMessageProcessor | undefined;

        if (enableFacebookMessenger) {
          facebookProcessor = await createFacebookMessageProcessor({
            client: req.app.facebookClient,
            leafSelector: req.leafSelector,
          });
        }

        if (enableTelegramMessenger) {
          telegramProcessor = await createTelegramMessageProcessor({
            client: req.app.telegramClient,
            leafSelector: req.leafSelector,
          });
        }

        const messageProcessor = createCrossPlatformMessageProcessor({
          facebook: facebookProcessor,
          telegram: telegramProcessor,
        });

        return messageProcessor;
      }
    );
  },
  get messenger(): IMicrobackendRequest["messenger"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendRequest,
      "messenger",
      async (req) => {
        const messageProcessor = await req.messageProcessor;

        const messenger = await createMessenger({
          leafSelector: req.leafSelector,
          processor: messageProcessor,
        });

        return messenger;
      }
    );
  },
};
