import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class DevConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {};
  }
}
