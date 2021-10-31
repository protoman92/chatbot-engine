import { MessageProcessorMiddleware } from "@haipham/chatbot-engine-core";

export const mockResponseCapturer = (() => {
  let sentResponses: any[] = [];

  return {
    captureResponse: async function (...response: any[]) {
      sentResponses = sentResponses.concat(response);
    },
    getSentResponses: async function () {
      return sentResponses;
    },
    reset: async function () {
      sentResponses = [];
    },
  };
})();

export default function captureGenericResponse<
  Context
>(): MessageProcessorMiddleware<Context> {
  return function captureGenericResponseForTest() {
    return async (processor) => ({
      ...processor,
      sendResponse: async ({ genericResponse }) => {
        await mockResponseCapturer.captureResponse(genericResponse);
        return processor.sendResponse({ genericResponse });
      },
    });
  };
}
