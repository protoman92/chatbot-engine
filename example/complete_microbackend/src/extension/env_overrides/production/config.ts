import { MicrobackendConfig } from "@microbackend/plugin-core";

export default class PrdConfig extends MicrobackendConfig {
  get config(): MicrobackendConfig["config"] {
    return {};
  }
}
