import { MicrobackendBranch } from "@microbackend/plugin-chatbot-engine-express";

export default class CatchAllBranch extends MicrobackendBranch {
  get branch(): MicrobackendBranch["branch"] {
    return {};
  }
}
