import {
  BaseMessageProcessor,
  Branch,
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
import { createPluginHelpers } from "@microbackend/common-utils";
import {
  IMicrobackendRequest,
  initializeOnce,
} from "@microbackend/plugin-core";
import { Writable } from "ts-essentials";
import {
  IMicrobackendBranch,
  IMicrobackendBranchArgs,
  IMicrobackendBranchCreator,
  LeafHandlingError,
  MicrobackendBranch,
} from "..";
import { PLUGIN_NAME } from "../utils";

declare module "@microbackend/plugin-core" {
  interface IMicrobackendRequest {
    readonly chatbotEngine: Readonly<{
      branches: Promise<Branch>;
      callbacks: IMicrobackendConfig["chatbotEngine"]["callbacks"];
      leafSelector: Promise<LeafSelector>;
      messageProcessor: Promise<BaseMessageProcessor>;
      messenger: Promise<Messenger>;
    }>;
  }
}

export default {
  get chatbotEngine(): IMicrobackendRequest["chatbotEngine"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendRequest,
      "chatbotEngine",
      (req) => {
        const helpers = createPluginHelpers(PLUGIN_NAME);

        return {
          get branches(): IMicrobackendRequest["chatbotEngine"]["branches"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbotEngine"],
              "branches",
              async () => {
                const exts = require("./chatbot_engine/branch");
                const branches: Writable<Branch> = {};

                for (const extKey in exts) {
                  if (extKey === "default") {
                    continue;
                  }

                  let ext = exts[extKey];

                  if (ext.default != null) {
                    ext = ext.default;
                  }

                  const BranchCreator = ext as
                    | IMicrobackendBranchCreator
                    | typeof MicrobackendBranch;

                  if (typeof BranchCreator !== "function") {
                    throw helpers.createError(
                      `branch creator ${extKey} must be a function producing a`,
                      "branch, or a class that extends MicrobackendBranch",
                      `(imported from "@microbackend/plugin-chatbot-engine").`
                    );
                  }

                  const creatorArgs: IMicrobackendBranchArgs = { request: req };
                  let branch: Branch;

                  if (
                    Object.getPrototypeOf(BranchCreator) === MicrobackendBranch
                  ) {
                    branch = await Promise.resolve(
                      new ((BranchCreator as unknown) as new (
                        args: IMicrobackendBranchArgs
                      ) => IMicrobackendBranch)(creatorArgs).branch
                    );
                  } else {
                    branch = await Promise.resolve(
                      (BranchCreator as IMicrobackendBranchCreator)(creatorArgs)
                        .branch
                    );
                  }

                  branches[extKey] = branch;
                }

                return branches;
              }
            );
          },
          get callbacks(): IMicrobackendRequest["chatbotEngine"]["callbacks"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbotEngine"],
              "callbacks",
              () => {
                return req.app.config.chatbotEngine.callbacks;
              }
            );
          },
          get leafSelector(): IMicrobackendRequest["chatbotEngine"]["leafSelector"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbotEngine"],
              "leafSelector",
              async () => {
                const branch = await req.chatbotEngine.branches;
                const leafSelector = createLeafSelector(branch);

                return createTransformChain()
                  .pipe(
                    catchError(
                      await createDefaultErrorLeaf({
                        formatErrorMessage:
                          req.app.config.chatbotEngine.formatLeafError,
                        trackError: (args) => {
                          req.chatbotEngine.callbacks.onError?.call(
                            undefined,
                            req,
                            new LeafHandlingError(args)
                          );
                        },
                      })
                    )
                  )
                  .transform(leafSelector);
              }
            );
          },
          get messageProcessor(): IMicrobackendRequest["chatbotEngine"]["messageProcessor"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbotEngine"],
              "messageProcessor",
              async () => {
                const leafSelector = await req.chatbotEngine.leafSelector;
                let facebookProcessor: FacebookMessageProcessor | undefined;
                let telegramProcessor: TelegramMessageProcessor | undefined;

                if (req.app.config.chatbotEngine.facebook.isEnabled) {
                  facebookProcessor = await createFacebookMessageProcessor({
                    leafSelector,
                    client: req.app.chatbotEngine.facebookClient,
                  });
                }

                if (req.app.config.chatbotEngine.telegram.isEnabled) {
                  telegramProcessor = await createTelegramMessageProcessor({
                    leafSelector,
                    client: req.app.chatbotEngine.telegramClient,
                  });
                }

                return createCrossPlatformMessageProcessor({
                  facebook: facebookProcessor,
                  telegram: telegramProcessor,
                });
              }
            );
          },
          get messenger(): IMicrobackendRequest["chatbotEngine"]["messenger"] {
            return initializeOnce(
              (this as unknown) as IMicrobackendRequest["chatbotEngine"],
              "messenger",
              async () => {
                const leafSelector = await req.chatbotEngine.leafSelector;
                const processor = await req.chatbotEngine.messageProcessor;
                return createMessenger({ leafSelector, processor });
              }
            );
          },
        };
      }
    );
  },
};
