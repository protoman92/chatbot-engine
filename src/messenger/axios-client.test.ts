// tslint:disable-next-line:import-name
import axiosStatic, { AxiosInstance, AxiosResponse } from "axios";
import expectJs from "expect.js";
import { beforeEach, describe } from "mocha";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { createAxiosClient } from "./axios-client";
import { HTTPClient } from "../type/client";

describe("Axios client", () => {
  let axios: AxiosInstance;
  let client: HTTPClient;

  beforeEach(() => {
    axios = spy<AxiosInstance>(axiosStatic);
    client = createAxiosClient(instance(axios));
  });

  it("Should call correct axios methods", async () => {
    // Setup
    const url = "some-url";

    const response: AxiosResponse<any> = {
      data: { a: 1, b: 2 },
      status: 200,
      statusText: "123",
      headers: {},
      config: {},
    };

    when(axios.get(anything(), anything())).thenResolve(response);
    when(axios.post(anything(), anything(), anything())).thenResolve(response);

    // When
    const body = { a: 1, b: 2 };
    const headers = { a: 1, b: 2 };
    const maxContentLength = 0;
    const query = { a: 1, b: 2 };

    const getData = await client.communicate({
      url,
      headers,
      query,
      maxContentLength,
      method: "GET",
    });

    const postData = await client.communicate({
      url,
      body,
      headers,
      maxContentLength,
      query,
      method: "POST",
    });

    // Then
    const configAssert = deepEqual({
      headers,
      maxContentLength,
      params: query,
    });

    verify(axios.get(url, configAssert)).once();
    verify(axios.post(url, deepEqual(body), configAssert)).once();
    expectJs(getData).to.eql(response.data);
    expectJs(postData).to.eql(response.data);
  });

  it("Should throw error if call fails", async () => {
    // Setup
    const url = "some-url";
    const error = new Error("Something happened");
    when(axios.get(anything(), anything())).thenThrow(error);

    // When
    try {
      await client.communicate({
        url,
        headers: {},
        query: {},
        method: "GET",
      });

      throw new Error("Never should have come here");
    } catch ({ message }) {
      // Then
      expectJs(message).to.equal(error.message);
    }
  });
});
