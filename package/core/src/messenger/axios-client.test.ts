// tslint:disable-next-line:import-name
import axiosStatic, { AxiosInstance, AxiosResponse } from "axios";
import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { createAxiosClient } from "./axios-client";
import { HTTPClient } from "../type";

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

    const getData = await client.requestWithErrorCapture({
      url,
      headers,
      query,
      maxContentLength,
      method: "GET",
    });

    const postData = await client.requestWithErrorCapture({
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
    expect(getData).toEqual({ data: response.data });
    expect(postData).toEqual({ data: response.data });
  });

  it("Should not throw error if call fails with error capture", async () => {
    // Setup
    const url = "some-url";
    const error: any = new Error("Something happened");
    when(axios.get(anything(), anything())).thenThrow(error);

    // When && Then: error has not response data
    let response = await client.requestWithErrorCapture({
      url,
      headers: {},
      query: {},
      method: "GET",
    });

    expect(response.error).toHaveProperty("message", error.message);

    // When && Then: error has response data
    error.response = { data: { description: "Something happened" } };

    response = await client.requestWithErrorCapture({
      url,
      headers: {},
      query: {},
      method: "GET",
    });

    expect(response.error).toEqual(error.response.data);
  });
});
