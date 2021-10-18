import axios from "axios";
import { DeepPartial } from "ts-essentials";
import { InMemoryContextData } from "../../context/InMemoryContextDAO";
import { AmbiguousGenericRequest, AmbiguousGenericResponse } from "../../type";

export const chatbotTestConfiguration = {
  baseURL: "",
};

export async function getSentResponses<Context>({
  targetPlatform,
}: Pick<AmbiguousGenericRequest<Context>, "targetPlatform">) {
  const { data } = await axios.request<
    readonly AmbiguousGenericResponse<Context>[]
  >({
    baseURL: chatbotTestConfiguration.baseURL,
    method: "GET",
    url: `/webhook/${targetPlatform}/sent-response`,
  });

  return data;
}

export async function sendMessageRequest<Context>(
  data: DeepPartial<AmbiguousGenericRequest<Context>>
) {
  await axios.request({
    data,
    baseURL: chatbotTestConfiguration.baseURL,
    method: "POST",
    url: `/webhook/${data.targetPlatform}`,
  });
}

export async function resetAllMocks() {
  await axios.request({
    baseURL: chatbotTestConfiguration.baseURL,
    method: "POST",
    url: "/webhook/reset",
  });
}

export async function getMockContextData<Context>() {
  const { data } = await axios.request<Context>({
    baseURL: chatbotTestConfiguration.baseURL,
    method: "GET",
    url: "/webhook/get-context",
  });

  return data;
}

export async function setMockContextData<Context>({
  context: data,
}: Readonly<{ context: DeepPartial<InMemoryContextData<Context>> }>) {
  await axios.request({
    data,
    baseURL: chatbotTestConfiguration.baseURL,
    method: "POST",
    url: "/webhook/set-context",
  });
}
