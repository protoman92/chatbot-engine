import createMicrobackendConfig, {
  mergeConfigs,
} from "@microbackend/plugin-core/build/webpack.build";
import path from "path";
import { Configuration } from "webpack"
import nodeExternals from "webpack-node-externals";
import "./src/interface/microbackend";

const config = (async (): Promise<Configuration> => {
  const coreConfig = await createMicrobackendConfig({
    pluginOptions: {
      "@microbackend/plugin-env-vars": {
        requiredEnvVariables: ["NODE_ENV"],
      },
    },
  });

  return mergeConfigs(coreConfig, {
    externals: [nodeExternals({ allowlist: /^\@microbackend.*$/ })],
    mode: "development",
    output: { path: path.join(__dirname, "build"), filename: "index.js" },
  });
})();

export default config;
