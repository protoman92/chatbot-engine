import {
  Branch,
  catchError,
  createCrossPlatformMessageProcessor,
  createDefaultErrorLeaf,
  createFacebookClient,
  createFacebookMessageProcessor,
  createLeafSelector,
  createMessenger,
  createTelegramClient,
  createTelegramMessageProcessor,
  createTransformChain,
  defaultAxiosClient,
  FacebookConfig,
  FacebookMessageProcessor,
  TelegramConfig,
  TelegramMessageProcessor,
  _TelegramRawResponse,
} from "@haipham/chatbot-engine-core";
import { createPluginHelpers } from "@microbackend/common-utils";
import {
  IMicrobackendRequest,
  IMicrobackendRequestConfig,
  initializeOnce,
} from "@microbackend/plugin-core";
import joi, { ObjectSchema, StrictSchemaMap } from "joi";
import { Writable } from "ts-essentials";
import {
  IMicrobackendBranch,
  IMicrobackendBranchArgs,
  IMicrobackendBranchCreator,
  LeafHandlingError,
  MicrobackendBranch,
} from "..";
import { PLUGIN_NAME } from "../utils";

export default {
  get chatbotEngine(): IMicrobackendRequest["chatbotEngine"] {
    return initializeOnce(
      this as IMicrobackendRequest,
      "chatbotEngine",
      (req) => {
        const helpers = createPluginHelpers(PLUGIN_NAME);

        return {
          get contextDAO(): IMicrobackendRequest["chatbotEngine"]["contextDAO"] {
            return req.config.chatbotEngine.contextDAO;
          },
          get facebookClient(): IMicrobackendRequest["chatbotEngine"]["facebookClient"] {
            return initializeOnce(this, "facebookClient", () => {
              if (!req.app.config.chatbotEngine.messenger.facebook.isEnabled) {
                throw helpers.createError(
                  `Facebook messenger is not enabled, please make sure the`,
                  `appropriate Facebook messenger configuration is available`,
                  `in app.config.`
                );
              }

              const { error: validationError } = joi
                .object<
                  IMicrobackendRequestConfig["chatbotEngine"]["messenger"]["facebook"],
                  true
                >({
                  client: joi.object<FacebookConfig, true>({
                    apiVersion: joi.string().min(1).required(),
                    pageToken: joi.string().min(1).required(),
                    verifyToken: joi.string().min(1).required(),
                  }) as ObjectSchema<StrictSchemaMap<FacebookConfig>>,
                  middlewares: joi.array().required(),
                })
                .validate(req.config.chatbotEngine.messenger.facebook);

              if (validationError != null) {
                throw helpers.createError(validationError.message);
              }

              return createFacebookClient(
                defaultAxiosClient,
                req.config.chatbotEngine.messenger.facebook.client
              );
            });
          },
          get branches(): IMicrobackendRequest["chatbotEngine"]["branches"] {
            return initializeOnce(this, "branches", async () => {
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
            });
          },
          get leafSelector(): IMicrobackendRequest["chatbotEngine"]["leafSelector"] {
            return initializeOnce(this, "leafSelector", async () => {
              const branch = await req.chatbotEngine.branches;
              const leafSelector = createLeafSelector(branch);

              return createTransformChain()
                .pipe(
                  catchError(
                    await createDefaultErrorLeaf({
                      formatErrorMessage:
                        req.config.chatbotEngine.leaf.formatErrorMessage,
                      trackError: (args) => {
                        req.config.chatbotEngine.leaf.onError?.call(
                          undefined,
                          new LeafHandlingError(args)
                        );
                      },
                    })
                  )
                )
                .transform(leafSelector);
            });
          },
          get messageProcessor(): IMicrobackendRequest["chatbotEngine"]["messageProcessor"] {
            return initializeOnce(this, "messageProcessor", async () => {
              const leafSelector = await req.chatbotEngine.leafSelector;
              let facebookProcessor: FacebookMessageProcessor | undefined;
              let telegramProcessor: TelegramMessageProcessor | undefined;

              if (req.app.config.chatbotEngine.messenger.facebook.isEnabled) {
                facebookProcessor = await createFacebookMessageProcessor(
                  {
                    leafSelector,
                    client: req.chatbotEngine.facebookClient,
                  },
                  ...req.config.chatbotEngine.messenger.facebook.middlewares
                );
              }

              if (req.app.config.chatbotEngine.messenger.telegram.isEnabled) {
                telegramProcessor = await createTelegramMessageProcessor(
                  {
                    leafSelector,
                    client: req.chatbotEngine.telegramClient,
                  },
                  ...req.config.chatbotEngine.messenger.telegram.middlewares
                );
              }

              return createCrossPlatformMessageProcessor({
                facebook: facebookProcessor,
                telegram: telegramProcessor,
              });
            });
          },
          get messenger(): IMicrobackendRequest["chatbotEngine"]["messenger"] {
            return initializeOnce(this, "messenger", async () => {
              const leafSelector = await req.chatbotEngine.leafSelector;
              const processor = await req.chatbotEngine.messageProcessor;
              return createMessenger({ leafSelector, processor });
            });
          },
          get telegramClient(): IMicrobackendRequest["chatbotEngine"]["telegramClient"] {
            return initializeOnce(this, "telegramClient", () => {
              if (!req.app.config.chatbotEngine.messenger.telegram.isEnabled) {
                throw helpers.createError(
                  `Telegram messenger is not enabled, please make sure the`,
                  `appropriate Telegram messenger configuration is available`,
                  `in app.config.`
                );
              }

              const { error: validationError } = joi
                .object<
                  IMicrobackendRequestConfig["chatbotEngine"]["messenger"]["telegram"],
                  true
                >({
                  client: joi.object<TelegramConfig, true>({
                    authToken: joi.string().min(1).required(),
                    defaultParseMode: joi
                      .string()
                      .valid(
                        ...Object.keys((): {
                          [K in _TelegramRawResponse.ParseMode]: boolean;
                        } => {
                          return { html: true, markdown: true };
                        })
                      )
                      .optional(),
                    defaultPaymentProviderToken: joi.string().min(1),
                  }) as ObjectSchema<StrictSchemaMap<TelegramConfig>>,
                  middlewares: joi.array().required(),
                })
                .validate(req.config.chatbotEngine.messenger.telegram);

              if (validationError != null) {
                throw helpers.createError(validationError.message);
              }

              return createTelegramClient(defaultAxiosClient, {
                defaultParseMode: "html",
                ...req.config.chatbotEngine.messenger.telegram.client,
              });
            });
          },
        };
      }
    );
  },
};
