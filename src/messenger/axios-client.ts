import axios, { AxiosInstance } from "axios";
import { HTTPClient } from "../type/client";

/** Create a default HTTP client using axios */
export function createAxiosClient(axiosInstance: AxiosInstance = axios) {
  const client: HTTPClient = {
    communicate: async (request) => {
      const { url, headers = {}, query: params } = request;

      const { data } = await (function() {
        switch (request.method) {
          case "GET":
            return axiosInstance.get(url, { headers, params });

          case "POST":
            return axiosInstance.post(url, request.body, { headers, params });
        }
      })();

      return data;
    },
  };

  return client;
}

export default createAxiosClient();
