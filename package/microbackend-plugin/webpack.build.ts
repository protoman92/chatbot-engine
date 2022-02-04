import { getPackage } from "@microbackend/build-utils";
import {
  mergeConfigs,
  REGEX_REPLACE_WITH_IMPORTS,
} from "@microbackend/plugin-core/build/utils.build";
import { createMicrobackendExtension } from "@microbackend/plugin-core/build/webpack.build";
import path from "path";
import { Configuration } from "webpack";
import type { IPluginOptions } from "./src";

export default ({
  allPlugins,
  enableFacebookMessenger,
  enableTelegramMessenger,
  environment,
}: IPluginOptions): Configuration => {
  return mergeConfigs(
    createMicrobackendExtension({
      environment,
      dirname: __dirname,
      extensionSubpath: path.join("chatbot_engine", "branch"),
      plugins: allPlugins,
    }),
    {
      module: {
        rules: [
          {
            loader: "string-replace-loader",
            options: {
              replace: () => {
                return `
enableFacebookMessenger = ${enableFacebookMessenger};
enableTelegramMessenger = ${enableTelegramMessenger};
              `.trim();
              },
              search: REGEX_REPLACE_WITH_IMPORTS,
            },
            test: path.join(
              getPackage({ dirname: __dirname }).absoluteMainDir,
              "feature_switch.js"
            ),
          },
        ],
      },
    }
  );
};
