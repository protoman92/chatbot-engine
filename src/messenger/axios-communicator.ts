import axios, { AxiosInstance } from 'axios';
import { HTTPCommunicator } from '../type/communicator';

/**
 * Create a default HTTP communicator using axios.
 * @param axiosInstance An axios instance.
 * @return A HTTP communicator instance.
 */
export function createAxiosCommunicator(axiosInstance: AxiosInstance = axios) {
  const communicator: HTTPCommunicator = {
    communicate: async request => {
      const { url, headers = {}, query: params } = request;

      const { data } = await (function() {
        switch (request.method) {
          case 'GET':
            return axiosInstance.get(url, { headers, params });

          case 'POST':
            return axiosInstance.post(url, request.body, { headers, params });
        }
      })();

      return data;
    }
  };

  return communicator;
}
