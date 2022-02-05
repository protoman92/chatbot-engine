import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class LocalConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {};
  }
}
