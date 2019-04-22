import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import {
  anything,
  capture,
  deepEqual,
  instance,
  spy,
  verify,
  when
} from 'ts-mockito';
import {
  Context,
  createGenericUnitMessenger,
  GenericRequest,
  GenericResponse,
  LeafSelector,
  PlatformCommunicator
} from '../../src';

const senderID = 'sender-id';

describe('Generic unit messenger', () => {
  let leafSelector: LeafSelector<Context>;
  let communicator: PlatformCommunicator;

  beforeEach(async () => {
    leafSelector = spy<LeafSelector<Context>>({
      next: () => Promise.reject(''),
      subscribe: () => Promise.reject('')
    });

    communicator = spy<PlatformCommunicator>({
      getUser: () => Promise.reject(''),
      sendResponse: () => Promise.reject(''),
      setTypingIndicator: () => Promise.reject('')
    });
  });

  it('Should process input when receiving request', async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(communicator.sendResponse(anything())).thenResolve();
    const platformResponses = [
      {
        a: 1
      },
      {
        b: 2
      }
    ];

    // When
    const unitMessenger = spy(
      await createGenericUnitMessenger(
        instance(leafSelector),
        instance(communicator),
        async () => platformResponses
      )
    );

    // Then
    const { next, complete } = capture(leafSelector.subscribe).first()[0];
    const response: GenericResponse<Context> = {
      senderID,
      visualContents: []
    };
    await next(response);
    expectJs(complete).to.be.ok();
    verify(unitMessenger.sendResponse(deepEqual(response))).once();

    platformResponses.forEach(response => {
      verify(communicator.sendResponse(deepEqual(response))).once();
    });
  });

  it('Should trigger send with valid response', async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(leafSelector.next(anything())).thenResolve();

    const oldContext: Context = { senderID, a: 1, b: 2 };

    const data: readonly GenericRequest.Input[] = [
      { inputText: 'text-1' },
      { inputText: 'text-2' }
    ];

    // When
    const unitMessenger = await createGenericUnitMessenger(
      instance(leafSelector),
      instance(communicator),
      async () => []
    );

    await unitMessenger.receiveRequest({ senderID, oldContext, data });

    // Then
    data.forEach(datum =>
      verify(
        leafSelector.next(deepEqual({ ...datum, senderID, oldContext }))
      ).once()
    );
  });
});
