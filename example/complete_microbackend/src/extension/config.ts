import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class CommonConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {};
  }
}
