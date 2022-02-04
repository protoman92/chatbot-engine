import {
  BaseMessageProcessor,
  catchAll,
  catchError,
  createCrossPlatformMessageProcessor,
  createDefaultErrorLeaf,
  createFacebookMessageProcessor,
  createLeafSelector,
  createMessenger,
  createTelegramMessageProcessor,
  createTransformChain,
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
    readonly chatbot: Readonly<{
      leafSelector: Promise<LeafSelector>;
      messageProcessor: Promise<BaseMessageProcessor>;
      messenger: Promise<Messenger>;
    }>;
  }
}

export default {
  get chatbot(): IMicrobackendRequest["chatbot"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendRequest,
      "chatbot",
      (req) => {
        return {
          get leafSelector(): IMicrobackendRequest["chatbot"]["leafSelector"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbot"],
              "leafSelector",
              async () => {
                const leafSelector = await createTransformChain()
                  .pipe(catchAll(() => {}))
                  .pipe(
                    catchError(
                      await createDefaultErrorLeaf({
                        formatErrorMessage: () => {
                          return "";
                        },
                        trackError: () => {},
                      })
                    )
                  )
                  .transform(createLeafSelector({}));

                return leafSelector;
              }
            );
          },
          get messageProcessor(): IMicrobackendRequest["chatbot"]["messageProcessor"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbot"],
              "messageProcessor",
              async () => {
                const leafSelector = await req.chatbot.leafSelector;
                let facebookProcessor: FacebookMessageProcessor | undefined;
                let telegramProcessor: TelegramMessageProcessor | undefined;

                if (enableFacebookMessenger) {
                  facebookProcessor = await createFacebookMessageProcessor({
                    leafSelector,
                    client: req.app.chatbot.facebookClient,
                  });
                }

                if (enableTelegramMessenger) {
                  telegramProcessor = await createTelegramMessageProcessor({
                    leafSelector,
                    client: req.app.chatbot.telegramClient,
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
          get messenger(): IMicrobackendRequest["chatbot"]["messenger"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbot"],
              "messenger",
              async () => {
                const leafSelector = await req.chatbot.leafSelector;
                const messageProcessor = await req.chatbot.messageProcessor;

                const messenger = await createMessenger({
                  leafSelector,
                  processor: messageProcessor,
                });

                return messenger;
              }
            );
          },
        };
      }
    );
  },
};
