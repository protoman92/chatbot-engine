import axios, { AxiosRequestConfig } from "axios";
import { AmbiguousRequest } from "../../type";

export async function getSentResponses<Context>({
  baseURL,
  targetPlatform,
}: Pick<AxiosRequestConfig, "baseURL"> &
  Pick<AmbiguousRequest<Context>, "targetPlatform">) {
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
}: Pick<AxiosRequestConfig, "baseURL"> & AmbiguousRequest<Context>) {
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
