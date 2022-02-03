import { getPackage } from "@microbackend/build-utils";
import { REGEX_REPLACE_WITH_IMPORTS } from "@microbackend/plugin-core/build/utils.build";
import path from "path";
import { Configuration } from "webpack";
import type { IPluginOptions } from "./src";

export default ({
  enableFacebookMessenger,
  enableTelegramMessenger,
}: IPluginOptions): Configuration => {
  return {
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
            "extension",
            "feature-switch.js"
          ),
        },
      ],
    },
  };
};
