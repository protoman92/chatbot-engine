import { FacebookClient, FacebookUser } from "@haipham/chatbot-engine-core";

export interface MockFacebookClientData {
  readonly facebookUser: FacebookUser;
}

export const mockFacebookClient = (() => {
  let mockData: Partial<MockFacebookClientData> | undefined;

  const client: FacebookClient = {
    getUser: async function () {
      if (mockData?.facebookUser == null) throw new Error("FB_GET_USER");
      return mockData.facebookUser;
    },
    resolveVerifyChallenge: async function () {
      throw new Error("FB_RESOLVE_VERIFY_CHALLENGE");
    },
    sendMenuSettings: async function () {},
    sendResponse: async function () {},
    setTypingIndicator: async function () {},
    uploadAttachment: async function () {
      throw new Error("FB_UPLOAD_ATTACHMENT");
    },
  };

  return {
    ...client,
    reset: function () {
      mockData = undefined;
    },
    setData: function (data: Partial<MockFacebookClientData>) {
      mockData = data;
    },
  };
})();

export default function createMockFacebookClient(): FacebookClient {
  return mockFacebookClient;
}
