// tslint:disable-next-line:import-name
import axiosStatic, { AxiosInstance, AxiosResponse } from 'axios';
import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { createAxiosCommunicator } from './axios-communicator';
import { HTTPCommunicator } from '../type/communicator';

describe('Axios communicator', () => {
  let axios: AxiosInstance;
  let communicator: HTTPCommunicator;

  beforeEach(() => {
    axios = spy<AxiosInstance>(axiosStatic);
    communicator = createAxiosCommunicator(instance(axios));
  });

  it('Should call correct axios methods', async () => {
    // Setup
    const url = 'some-url';

    const response: AxiosResponse<any> = {
      data: { a: 1, b: 2 },
      status: 200,
      statusText: '123',
      headers: {},
      config: {}
    };

    when(axios.get(anything(), anything())).thenResolve(response);
    when(axios.post(anything(), anything(), anything())).thenResolve(response);

    // When
    const body = { a: 1, b: 2 };
    const headers = { a: 1, b: 2 };
    const query = { a: 1, b: 2 };

    const getData = await communicator.communicate({
      url,
      headers,
      query,
      method: 'GET'
    });

    const postData = await communicator.communicate({
      url,
      body,
      headers,
      query,
      method: 'POST'
    });

    // Then
    const configAssert = deepEqual({ headers, params: query });
    verify(axios.get(url, configAssert)).once();
    verify(axios.post(url, deepEqual(body), configAssert)).once();
    expectJs(getData).to.eql(response.data);
    expectJs(postData).to.eql(response.data);
  });

  it('Should throw error if call fails', async () => {
    // Setup
    const url = 'some-url';
    const error = new Error('Something happened');
    when(axios.get(anything(), anything())).thenThrow(error);

    // When
    try {
      await communicator.communicate({
        url,
        headers: {},
        query: {},
        method: 'GET'
      });

      throw new Error('Never should have come here');
    } catch ({ message }) {
      // Then
      expectJs(message).to.equal(error.message);
    }
  });
});
