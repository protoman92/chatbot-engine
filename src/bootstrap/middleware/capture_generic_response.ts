import { MessageProcessorMiddleware } from "../../type";

export default function <Context>(): MessageProcessorMiddleware<Context> {
  return () => async (processor) => processor;
}
