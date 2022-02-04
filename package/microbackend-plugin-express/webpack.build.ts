import { mergeConfigs } from "@microbackend/plugin-core/build/utils.build";
import { createMicrobackendExtension } from "@microbackend/plugin-core/build/webpack.build";
import path from "path";
import { TsconfigPathsPlugin } from "tsconfig-paths-webpack-plugin";
import { Configuration } from "webpack";
import type { IPluginOptions } from "./src";

export default ({ allPlugins, environment }: IPluginOptions): Configuration => {
  return mergeConfigs(
    createMicrobackendExtension({
      environment,
      dirname: __dirname,
      extensionSubpath: path.join("chatbot_engine", "branch"),
      plugins: allPlugins,
    }),
    { resolve: { plugins: [new TsconfigPathsPlugin()] } }
  );
};
