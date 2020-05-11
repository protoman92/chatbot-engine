import expectJs from "expect.js";
import { describe, it } from "mocha";
import { instance, spy, when } from "ts-mockito";
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
    expectJs(challenge).to.equal(hubChallenge);
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
});
