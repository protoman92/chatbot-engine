import { BaseMessageProcessor, Messenger } from "@haipham/chatbot-engine-core";
import {
  IMicrobackendRequest,
  initializeOnce,
} from "@microbackend/plugin-core";

declare module "@microbackend/plugin-core" {
  interface IMicrobackendRequest {
    readonly chatbot: Readonly<{
      messageProcessor: BaseMessageProcessor<unknown>;
      messenger: Messenger;
    }>;
  }
}

export default {
  get chatbot(): IMicrobackendRequest["chatbot"] {
    return initializeOnce(
      (this as unknown) as IMicrobackendRequest,
      "chatbot",
      () => {
        return {} as IMicrobackendRequest["chatbot"];
      }
    );
  },
};
