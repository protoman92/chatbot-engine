import expectJs from "expect.js";
import { describe, it } from "mocha";
import { instance, spy, when } from "ts-mockito";
import { HTTPCommunicator } from "../type/communicator";
import { FacebookCommunicator, FacebookConfigs } from "../type/facebook";
import { createFacebookCommunicator } from "./facebook-communicator";

describe("Facebook communicator", () => {
  let communicator: HTTPCommunicator;
  let configs: FacebookConfigs;
  let fbCommunicator: FacebookCommunicator;

  beforeEach(async () => {
    communicator = spy<HTTPCommunicator>({
      communicate: () => Promise.reject("")
    });

    configs = spy<FacebookConfigs>({
      apiVersion: "",
      pageToken: "",
      verifyToken: ""
    });

    fbCommunicator = createFacebookCommunicator(
      instance(communicator),
      instance(configs)
    );
  });

  it("Should resolve hub challenge if token matches", async () => {
    // Setup
    const verifyToken = "verify-token";
    const hubChallenge = 1000;
    when(configs.verifyToken).thenReturn(verifyToken);

    // When
    const challenge = await fbCommunicator.resolveVerifyChallenge({
      "hub.mode": "subscribe",
      "hub.challenge": hubChallenge,
      "hub.verify_token": verifyToken
    });

    // Then
    expectJs(challenge).to.equal(hubChallenge);
  });

  it("Should fail hub challenge if hub mode is wrong", async () => {
    // Setup
    const verifyToken = "verify-token";
    when(configs.verifyToken).thenReturn(verifyToken);

    try {
      // When && Then
      await fbCommunicator.resolveVerifyChallenge({
        "hub.challenge": 1000,
        "hub.verify_token": verifyToken
      });

      throw new Error("Never should have come here");
    } catch {}
  });

  it("Should fail hub challenge if token does not match", async () => {
    // Setup
    const hubChallenge = 1000;
    when(configs.verifyToken).thenReturn("verify-token");

    try {
      // When && Then
      await fbCommunicator.resolveVerifyChallenge({
        "hub.mode": "subscribe",
        "hub.challenge": hubChallenge
      });

      throw new Error("Never should have come here");
    } catch {}
  });
});
