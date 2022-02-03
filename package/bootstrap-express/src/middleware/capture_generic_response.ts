import { MessageProcessorMiddleware } from "@haipham/chatbot-engine-core";

export default function (): MessageProcessorMiddleware {
  return () => {
    return async (processor) => {
      return processor;
    };
  };
}
