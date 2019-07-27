import { beforeEach, describe, it } from 'mocha';
import {
  anything,
  deepEqual,
  instance,
  spy,
  verify,
  when,
  capture
} from 'ts-mockito';
import { HTTPCommunicator } from '../type/communicator';
import { WitCommunicator, WitConfigs } from '../type/wit';
import { createWitCommunicator } from './wit-communicator';

describe('Wit communicator', () => {
  let comm: HTTPCommunicator;
  let witConfig: WitConfigs;
  let witCommunicator: WitCommunicator;

  beforeEach(() => {
    comm = spy<HTTPCommunicator>({ communicate: () => Promise.reject('') });
    witConfig = spy<WitConfigs>({ authorizationToken: '' });

    witCommunicator = createWitCommunicator(
      instance(comm),
      instance(witConfig)
    );
  });

  it('Should communicate with wit API correctly', async () => {
    // Setup
    const authorizationToken = 'some-auth-token';
    when(comm.communicate(anything())).thenResolve({});
    when(witConfig.authorizationToken).thenReturn(authorizationToken);

    // When
    const message = 'some-message';
    await witCommunicator.validate(message);

    // Then
    console.log(capture<any>(comm.communicate));
    verify(
      comm.communicate(
        deepEqual({
          method: 'GET',
          url: `https://api.wit.ai/message?q=${message}`,
          headers: { Authorization: `Bearer ${authorizationToken}` }
        })
      )
    ).once();
  });
});
