import axios, { AxiosRequestConfig } from "axios";
import { MockContextData } from "../../context/InMemoryContextDAO";
import { AmbiguousGenericRequest } from "../../type";

export async function getSentResponses<Context>({
  baseURL,
  targetPlatform,
}: Pick<AxiosRequestConfig, "baseURL"> &
  Pick<AmbiguousGenericRequest<Context>, "targetPlatform">) {
  const { data } = await axios.request<unknown>({
    baseURL,
    method: "GET",
    url: `/webhook/${targetPlatform}/sent-response`,
  });

  return data;
}

export async function sendMessageRequest<Context>({
  baseURL,
  ...data
}: Pick<AxiosRequestConfig, "baseURL"> & AmbiguousGenericRequest<Context>) {
  await axios.request({
    baseURL,
    data,
    method: "POST",
    url: `/webhook/${data.targetPlatform}`,
  });
}

export async function resetAllMocks({
  baseURL,
}: Pick<AxiosRequestConfig, "baseURL">) {
  await axios.request({ baseURL, method: "POST", url: "/webhook/reset" });
}

export async function getMockContextData<Context>({
  baseURL,
}: Pick<AxiosRequestConfig, "baseURL">) {
  const { data } = await axios.request<Context>({
    baseURL,
    method: "GET",
    url: "/webhook/get-context",
  });

  return data;
}

export async function setMockContextData<Context>({
  baseURL,
  context: data,
}: Pick<AxiosRequestConfig, "baseURL"> &
  Readonly<{ context: MockContextData<Context> }>) {
  await axios.request({
    baseURL,
    data,
    method: "POST",
    url: "/webhook/set-context",
  });
}
