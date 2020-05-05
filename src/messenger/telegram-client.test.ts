import expectJs from "expect.js";
import { beforeEach, describe, it } from "mocha";
import { anything, instance, spy, verify, when } from "ts-mockito";
import { HTTPClient } from "../type/client";
import { TelegramClient, TelegramConfigs } from "../type/telegram";
import { createTelegramClient } from "./telegram-client";

describe("Telegram client", () => {
  let client: HTTPClient;
  let configs: TelegramConfigs;
  let tlClient: TelegramClient;

  beforeEach(() => {
    client = spy<HTTPClient>({
      communicate: () => Promise.reject(""),
    });

    configs = spy<TelegramConfigs>({
      authToken: "",
      defaultParseMode: "markdown",
      webhookURL: "",
    });

    tlClient = createTelegramClient(instance(client), instance(configs));
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
      chat_id: "",
      text: "Hey",
      reply_markup: undefined,
    });

    // Then
    expectJs(apiResponse).to.eql(result);
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
        chat_id: "",
        text: "Hey",
        reply_markup: undefined,
      });

      throw new Error("Never should have come here");
    } catch ({ message }) {
      expectJs(message).to.eql(description);
    }
  });

  it("Should not send typing action if setting to false", async () => {
    // Setup && When
    await tlClient.setTypingIndicator("", false);

    // Then
    verify(client.communicate(anything())).never();
  });
});
