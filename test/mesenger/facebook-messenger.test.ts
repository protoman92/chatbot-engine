import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, instance, spy, when } from 'ts-mockito';
import { createFacebookMessenger } from '../../src/messenger/facebook-messenger';
import { PlatformCommunicator } from '../../src/type/communicator';
import { FacebookConfigs } from '../../src/type/facebook';
import { Leaf } from '../../src/type/leaf';

describe('Facebook unit messenger', () => {
  interface Context {}

  let leafSelector: Leaf<Context>;
  let communicator: PlatformCommunicator<unknown>;
  let configs: FacebookConfigs;

  beforeEach(async () => {
    leafSelector = spy<Leaf<Context>>({
      next: () => Promise.reject(''),
      subscribe: () => Promise.reject('')
    });

    communicator = spy<PlatformCommunicator<unknown>>({
      getUser: () => Promise.reject(''),
      sendResponse: () => Promise.reject(''),
      setTypingIndicator: () => Promise.reject('')
    });

    configs = spy<FacebookConfigs>({
      apiVersion: '',
      pageToken: '',
      verifyToken: ''
    });
  });

  it('Should resolve hub challenge if tokens match', async () => {
    // Setup
    const verifyToken = 'verify-token';
    const hubChallenge = 1000;
    when(leafSelector.subscribe(anything())).thenResolve();
    when(configs.verifyToken).thenReturn(verifyToken);

    const unitMessenger = await createFacebookMessenger(
      instance(leafSelector),
      instance(communicator),
      instance(configs)
    );

    // When
    const challenge = await unitMessenger.resolveVerifyChallenge({
      'hub.mode': 'subscribe',
      'hub.challenge': hubChallenge,
      'hub.verify_token': verifyToken
    });

    // Then
    expectJs(challenge).to.equal(hubChallenge);
  });

  it('Should fail hub challenge if hub mode is wrong', async () => {
    // Setup
    const verifyToken = 'verify-token';
    when(leafSelector.subscribe(anything())).thenResolve();
    when(configs.verifyToken).thenReturn(verifyToken);

    const unitMessenger = await createFacebookMessenger(
      instance(leafSelector),
      instance(communicator),
      instance(configs)
    );

    try {
      // When && Then
      await unitMessenger.resolveVerifyChallenge({
        'hub.challenge': 1000,
        'hub.verify_token': verifyToken
      });

      throw new Error('Never should have come here');
    } catch {}
  });

  it('Should fail hub challenge if token does not match', async () => {
    // Setup
    const hubChallenge = 1000;
    when(leafSelector.subscribe(anything())).thenResolve();
    when(configs.verifyToken).thenReturn('verify-token');

    const unitMessenger = await createFacebookMessenger(
      instance(leafSelector),
      instance(communicator),
      instance(configs)
    );

    try {
      // When && Then
      await unitMessenger.resolveVerifyChallenge({
        'hub.mode': 'subscribe',
        'hub.challenge': hubChallenge
      });

      throw new Error('Never should have come here');
    } catch {}
  });
});
