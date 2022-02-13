import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { HTTPClient, TelegramClient, TelegramConfig } from "../type";
import { createTelegramClient } from "./telegram-client";

describe("Telegram client", () => {
  let client: HTTPClient;
  let config: TelegramConfig;
  let tlClient: TelegramClient;

  beforeEach(() => {
    client = spy<HTTPClient>({
      request: () => Promise.reject(""),
      requestWithErrorCapture: () => Promise.reject(""),
    });

    config = spy<TelegramConfig>({
      authToken: "",
      defaultParseMode: "markdown",
      defaultPaymentProviderToken: "payment-provider-token",
    });

    tlClient = createTelegramClient(instance(client), instance(config));
  });

  it("Should return result if ok is true", async () => {
    // Setup
    const result = 10000;

    when(client.requestWithErrorCapture(anything())).thenResolve({
      data: { result, description: "some-description", ok: true },
    });

    // When
    const apiResponse = await tlClient.sendResponse({
      action: "sendMessage",
      body: { chat_id: "", text: "" },
    });

    // Then
    expect(apiResponse).toEqual(result);
  });

  it("Should throw error if ok is false", async () => {
    // Setup
    const description = "some-error";

    when(client.requestWithErrorCapture(anything())).thenResolve({
      error: { description, ok: false },
    });

    try {
      // When
      await tlClient.sendResponse({
        action: "sendMessage",
        body: { chat_id: "", text: "" },
      });

      throw new Error("Never should have come here");
    } catch ({ message }) {
      expect(message).toEqual(description);
    }
  });

  it("Should not send typing action if setting to false", async () => {
    // Setup && When
    await tlClient.setTypingIndicator("", false);

    // Then
    verify(client.requestWithErrorCapture(anything())).never();
  });

  it("Should delete message with the correct chat and message IDs", async () => {
    // Setup
    const chatID = "chat-id";
    const messageID = "message-id";
    when(client.requestWithErrorCapture(anything())).thenResolve({
      data: { ok: true },
    });

    // When
    await tlClient.deleteMessage({ chatID, messageID });

    // Then
    verify(
      client.requestWithErrorCapture(
        deepEqual({
          method: "GET",
          query: { chat_id: chatID, message_id: messageID },
          url: "https://api.telegram.org/bot/deleteMessage",
        })
      )
    ).once();
  });

  it("Should include payment provider token if sending invoice", async () => {
    // Setup
    const chatID = "chat-id";
    when(client.requestWithErrorCapture(anything())).thenResolve({
      data: { ok: true },
    });

    // When
    await tlClient.sendResponse({
      action: "sendInvoice",
      body: {
        chat_id: chatID,
        currency: "SGD",
        description: "description",
        payload: "payload",
        prices: [{ amount: 100, label: "label" }],
        title: "title",
      },
    });

    // Then
    verify(
      client.requestWithErrorCapture(
        deepEqual({
          method: "POST",
          headers: {},
          body: {
            chat_id: chatID,
            currency: "SGD",
            description: "description",
            payload: "payload",
            provider_token: "payment-provider-token",
            prices: [{ amount: 100, label: "label" }],
            title: "title",
          },
          url: "https://api.telegram.org/bot/sendInvoice?parse_mode=markdown",
        })
      )
    ).once();
  });
});
