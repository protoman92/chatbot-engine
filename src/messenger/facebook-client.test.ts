import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { HTTPClient } from "../type/client";
import { FacebookClient, FacebookConfig } from "../type/facebook";
import { createFacebookClient } from "./facebook-client";

describe("Facebook client", () => {
  let client: HTTPClient;
  let config: FacebookConfig;
  let fbClient: FacebookClient;

  beforeEach(async () => {
    client = spy<HTTPClient>({
      communicate: () => Promise.reject(""),
    });

    config = spy<FacebookConfig>({
      apiVersion: "",
      pageToken: "",
      verifyToken: "",
    });

    fbClient = createFacebookClient(instance(client), instance(config));
  });

  it("Should resolve hub challenge if token matches", async () => {
    // Setup
    const verifyToken = "verify-token";
    const hubChallenge = 1000;
    when(config.verifyToken).thenReturn(verifyToken);

    // When
    const challenge = await fbClient.resolveVerifyChallenge({
      "hub.mode": "subscribe",
      "hub.challenge": hubChallenge,
      "hub.verify_token": verifyToken,
    });

    // Then
    expect(challenge).toEqual(hubChallenge);
  });

  it("Should fail hub challenge if hub mode is wrong", async () => {
    // Setup
    const verifyToken = "verify-token";
    when(config.verifyToken).thenReturn(verifyToken);

    try {
      // When && Then
      await fbClient.resolveVerifyChallenge({
        "hub.challenge": 1000,
        "hub.verify_token": verifyToken,
      });

      throw new Error("Never should have come here");
    } catch {}
  });

  it("Should fail hub challenge if token does not match", async () => {
    // Setup
    const hubChallenge = 1000;
    when(config.verifyToken).thenReturn("verify-token");

    try {
      // When && Then
      await fbClient.resolveVerifyChallenge({
        "hub.mode": "subscribe",
        "hub.challenge": hubChallenge,
      });

      throw new Error("Never should have come here");
    } catch {}
  });

  it("Should send menu settings correctly", async () => {
    // Setup
    when(client.communicate(anything())).thenResolve({});

    // When
    await fbClient.sendMenuSettings({ persistent_menu: [], psid: "" });

    // Then
    verify(
      client.communicate(
        deepEqual({
          body: { persistent_menu: [], psid: "" },
          headers: { "Content-Type": "application/json" },
          method: "POST",
          url:
            "https://graph.facebook.com/v/me/custom_user_settings?access_token=",
        })
      )
    ).once();
  });

  it("Should send messages correctly", async () => {
    // Setup
    when(client.communicate(anything())).thenResolve({});

    // When
    await fbClient.sendResponse({
      message: { text: "" },
      messaging_type: "RESPONSE",
      recipient: { id: "" },
    });

    // Then
    verify(
      client.communicate(
        deepEqual({
          body: {
            message: { text: "" },
            messaging_type: "RESPONSE",
            recipient: { id: "" },
          },
          headers: { "Content-Type": "application/json" },
          method: "POST",
          url: "https://graph.facebook.com/v/me/messages?access_token=",
        })
      )
    ).once();
  });

  it("Should set typing indicator correctly", async () => {
    // Setup
    when(client.communicate(anything())).thenResolve({});

    // When
    await fbClient.setTypingIndicator("", true);
    await fbClient.setTypingIndicator("", false);

    // Then
    verify(
      client.communicate(
        deepEqual({
          body: { recipient: { id: "" }, sender_action: "typing_on" },
          headers: { "Content-Type": "application/json" },
          method: "POST",
          url: "https://graph.facebook.com/v/me/messages?access_token=",
        })
      )
    ).once();

    verify(
      client.communicate(
        deepEqual({
          body: { recipient: { id: "" }, sender_action: "typing_off" },
          headers: { "Content-Type": "application/json" },
          method: "POST",
          url: "https://graph.facebook.com/v/me/messages?access_token=",
        })
      )
    ).once();
  });
});
