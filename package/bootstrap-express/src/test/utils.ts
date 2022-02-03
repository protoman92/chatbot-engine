import {
  AmbiguousGenericRequest,
  AmbiguousGenericResponse,
} from "@haipham/chatbot-engine-core";
import { InMemoryContextData } from "@haipham/chatbot-engine-core/src/context/InMemoryContextDAO";
import axios from "axios";
import { DeepPartial } from "ts-essentials";

export const chatbotTestConfiguration = {
  baseURL: "",
};

export async function getSentResponses({
  targetPlatform,
}: Pick<AmbiguousGenericRequest, "targetPlatform">) {
  const { data } = await axios.request<readonly AmbiguousGenericResponse[]>({
    baseURL: chatbotTestConfiguration.baseURL,
    method: "GET",
    url: `/webhook/${targetPlatform}/sent-response`,
  });

  return data;
}

export async function mergeMockContextData({
  context: data,
}: Readonly<{ context: DeepPartial<InMemoryContextData> }>) {
  await axios.request({
    data,
    baseURL: chatbotTestConfiguration.baseURL,
    method: "POST",
    url: "/webhook/merge-context",
  });
}

export async function sendMessageRequest(
  data: DeepPartial<AmbiguousGenericRequest>
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

export async function setMockContextData({
  context: data,
}: Readonly<{ context: DeepPartial<InMemoryContextData> }>) {
  await axios.request({
    data,
    baseURL: chatbotTestConfiguration.baseURL,
    method: "POST",
    url: "/webhook/set-context",
  });
}
