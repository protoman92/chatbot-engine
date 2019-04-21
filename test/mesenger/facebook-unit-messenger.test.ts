// import expectJs from 'expect.js';
// import { beforeEach, describe } from 'mocha';
// import { instance, spy, when } from 'ts-mockito';
// import {
//   Context,
//   createFacebookUnitMessenger,
//   FacebookConfigs,
//   FacebookUnitMessenger,
//   HTTPCommunicator,
//   LeafSelector
// } from '../../src';

// describe('Facebook unit messenger', () => {
//   let leafSelector: LeafSelector<Context>;
//   let httpCommunicator: HTTPCommunicator;
//   let configs: FacebookConfigs;
//   let facebookUnitMessenger: FacebookUnitMessenger<Context>;

//   beforeEach(() => {
//     leafSelector = spy<LeafSelector<Context>>({
//       selectLeaf: () => Promise.reject('')
//     });

//     httpCommunicator = spy<HTTPCommunicator>({
//       communicate: () => Promise.reject('')
//     });

//     configs = spy<FacebookConfigs>({
//       apiVersion: '',
//       pageToken: '',
//       verifyToken: ''
//     });

//     facebookUnitMessenger = createFacebookUnitMessenger(
//       instance(leafSelector),
//       instance(httpCommunicator),
//       instance(configs)
//     );
//   });

//   it('Should resolve hub challenge if tokens match', async () => {
//     // Setup
//     const verifyToken = 'verify-token';
//     const hubChallenge = 1000;
//     when(configs.verifyToken).thenReturn(verifyToken);

//     // When
//     const challenge = await facebookUnitMessenger.resolveVerifyChallenge({
//       'hub.mode': 'subscribe',
//       'hub.challenge': hubChallenge,
//       'hub.verify_token': verifyToken
//     });

//     // Then
//     expectJs(challenge).to.equal(hubChallenge);
//   });

//   it('Should fail hub challenge if hub mode is wrong', async () => {
//     // Setup
//     const verifyToken = 'verify-token';
//     when(configs.verifyToken).thenReturn(verifyToken);

//     try {
//       // When && Then
//       await facebookUnitMessenger.resolveVerifyChallenge({
//         'hub.challenge': 1000,
//         'hub.verify_token': verifyToken
//       });

//       throw new Error('Never should have come here');
//     } catch {}
//   });

//   it('Should fail hub challenge if token does not match', async () => {
//     // Setup
//     const hubChallenge = 1000;
//     when(configs.verifyToken).thenReturn('verify-token');

//     try {
//       // When && Then
//       await facebookUnitMessenger.resolveVerifyChallenge({
//         'hub.mode': 'subscribe',
//         'hub.challenge': hubChallenge
//       });

//       throw new Error('Never should have come here');
//     } catch {}
//   });
// });
