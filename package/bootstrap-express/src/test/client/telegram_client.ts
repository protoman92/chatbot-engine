import { TelegramClient } from "@haipham/chatbot-engine-core";

export const mockTelegramClient = (() => {
  const client: TelegramClient = {
    deleteMessage: async function () {},
    getCurrentBot: async function () {
      return { id: 0, first_name: "", username: "" };
    },
    getFile: async function () {
      throw new Error("Not implemented");
    },
    getFileURL: async function () {
      throw new Error("Not implemented");
    },
    getFileURLFromID: async function () {
      throw new Error("Not implemented");
    },
    isMember: async function () {
      throw new Error("Not implemented");
    },
    sendResponse: async function () {},
    setTypingIndicator: async function () {},
    setWebhook: async function () {},
  };

  return { ...client };
})();

export default function createMockTelegramClient(): TelegramClient {
  return mockTelegramClient;
}
