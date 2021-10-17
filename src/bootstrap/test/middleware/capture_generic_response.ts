import { MessageProcessorMiddleware } from "../../../type";

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
        const {
          originalRequest,
          additionalContext,
          ...captured
        } = genericResponse;

        await mockResponseCapturer.captureResponse(captured);
        return processor.sendResponse({ genericResponse });
      },
    });
  };
}
