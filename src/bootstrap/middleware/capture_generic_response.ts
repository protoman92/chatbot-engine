import { MessageProcessorMiddleware } from "../../type";

export default function <Context>(): MessageProcessorMiddleware<Context> {
  return () => {
    return async (processor) => {
      return processor;
    };
  };
}
