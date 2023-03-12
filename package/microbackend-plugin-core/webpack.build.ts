import { mergeConfigs } from "@microbackend/plugin-core/build/utils.build";
import { createMicrobackendExtension } from "@microbackend/plugin-core/build/webpack.build";
import path from "path";
import { Configuration } from "webpack";
import type { IPluginOptions } from "./src";

export default ({
  allPlugins,
  currentProjectDir,
  environment,
}: IPluginOptions): Promise<Configuration> => {
  return mergeConfigs(
    createMicrobackendExtension({
      environment,
      dirname: __dirname,
      extensionSubpath: path.join("chatbot_engine", "branch"),
      plugins: [...allPlugins, currentProjectDir],
    })
  );
};
