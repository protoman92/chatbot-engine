import axiosStatic, { AxiosInstance } from "axios";
import { HTTPClient } from "../type";

/** Create a default HTTP client using axios */
export function createAxiosClient(axios: AxiosInstance = axiosStatic) {
  const client: HTTPClient = {
    request: async (request) => {
      const { url, headers, maxContentLength, query: params } = request;

      /** Force ! to avoid TS complaining about undefined vs optional */
      const config = { headers: headers!, maxContentLength: maxContentLength! };

      const { data } = await (function () {
        switch (request.method) {
          case "GET":
            return axios.get(url, { params, ...config });

          case "POST":
            return axios.post(url, request.body, { params, ...config });
        }
      })();

      return data;
    },
    requestWithErrorCapture: async (request) => {
      try {
        const data = await client.request(request);
        return { data: data as any };
      } catch (error) {
        const _error = error as any;
        const errorData = _error?.response?.data ?? _error;
        return { error: errorData };
      }
    },
  };

  return client;
}

export default createAxiosClient();
