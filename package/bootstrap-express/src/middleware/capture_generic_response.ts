import { MessageProcessorMiddleware } from "@haipham/chatbot-engine-core";

export default function <Context>(): MessageProcessorMiddleware<Context> {
  return () => {
    return async (processor) => {
      return processor;
    };
  };
}
