import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { HTTPClient, WitClient, WitConfig } from "../type";
import { createWitClient } from "./wit-client";

describe("Wit client", () => {
  let comm: HTTPClient;
  let witConfig: WitConfig;
  let witClient: WitClient;

  beforeEach(() => {
    comm = spy<HTTPClient>({ communicate: () => Promise.reject("") });
    witConfig = spy<WitConfig>({ authorizationToken: "" });
    witClient = createWitClient(instance(comm), instance(witConfig));
  });

  it("Should communicate with wit API correctly", async () => {
    // Setup
    const authorizationToken = "some-auth-token";
    when(comm.communicate(anything())).thenResolve({});
    when(witConfig.authorizationToken).thenReturn(authorizationToken);

    // When
    const message = "some-message";
    await witClient.validate(message);

    // Then
    verify(
      comm.communicate(
        deepEqual({
          method: "GET",
          url: `https://api.wit.ai/message?q=${message}`,
          headers: { Authorization: `Bearer ${authorizationToken}` },
        })
      )
    ).once();
  });
});
