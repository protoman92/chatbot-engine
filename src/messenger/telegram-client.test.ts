import { anything, instance, spy, verify, when } from "ts-mockito";
import { HTTPClient, TelegramClient, TelegramConfig } from "../type";
import { createTelegramClient } from "./telegram-client";

describe("Telegram client", () => {
  let client: HTTPClient;
  let config: TelegramConfig;
  let tlClient: TelegramClient;

  beforeEach(() => {
    client = spy<HTTPClient>({
      communicate: () => Promise.reject(""),
    });

    config = spy<TelegramConfig>({
      authToken: "",
      defaultParseMode: "markdown",
    });

    tlClient = createTelegramClient(instance(client), instance(config));
  });

  it("Should return result if ok is true", async () => {
    // Setup
    const result = 10000;

    when(client.communicate(anything())).thenResolve({
      result,
      description: "some-description",
      ok: true,
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

    when(client.communicate(anything())).thenResolve({
      description,
      ok: false,
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
    verify(client.communicate(anything())).never();
  });
});
