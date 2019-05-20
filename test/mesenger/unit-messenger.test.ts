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
import { SupportedPlatform, UnitMessenger } from '../../src';
import { DEFAULT_COORDINATES } from '../../src/common/utils';
import {
  createCrossPlatformUnitMessenger,
  createGenericUnitMessenger
} from '../../src/messenger/generic-messenger';
import { KV } from '../../src/type/common';
import { PlatformCommunicator } from '../../src/type/communicator';
import { Leaf } from '../../src/type/leaf';
import { GenericRequest } from '../../src/type/request';
import { GenericResponse } from '../../src/type/response';

const senderID = 'sender-id';
const senderPlatform = 'facebook' as const;

describe('Generic unit messenger', () => {
  interface Context extends KV<unknown> {}

  let leafSelector: Leaf<Context>;
  let communicator: PlatformCommunicator<unknown>;

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
  });

  it('Should process input when receiving request', async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(communicator.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

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
      senderPlatform,
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
    const oldContext = { a: 1, b: 2 };

    const data: readonly GenericRequest.Input[] = [
      {
        inputText: 'text-1',
        inputImageURL: 'image-1',
        inputCoordinate: { lat: 0, lng: 0 },
        stickerID: ''
      },
      {
        inputText: 'text-2',
        inputImageURL: 'image-2',
        inputCoordinate: { lat: 1, lng: 1 },
        stickerID: ''
      }
    ];

    // When
    const unitMessenger = await createGenericUnitMessenger(
      instance(leafSelector),
      instance(communicator),
      async () => []
    );

    await unitMessenger.receiveRequest({
      senderID,
      senderPlatform,
      oldContext,
      data
    });

    // Then
    data.forEach(datum =>
      verify(
        leafSelector.next(
          deepEqual({ ...datum, ...oldContext, senderID, senderPlatform })
        )
      ).once()
    );
  });
});

describe('Cross platform unit messenger', () => {
  let facebookMessenger: UnitMessenger<{}>;
  let messengers: Readonly<{ [K in SupportedPlatform]: UnitMessenger<{}> }>;
  let crossMessenger: UnitMessenger<{}>;

  beforeEach(() => {
    facebookMessenger = spy<UnitMessenger<{}>>({
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({})
    });

    messengers = { facebook: facebookMessenger };

    crossMessenger = createCrossPlatformUnitMessenger(Object.entries(messengers)
      .map(([key, value]) => ({
        [key]: instance(value)
      }))
      .reduce((acc, item) => ({ ...acc, ...item })) as typeof messengers);
  });

  it('Should invoke correct messenger', async () => {
    // Setup
    const platforms = Object.keys(messengers) as readonly SupportedPlatform[];

    // When
    for (const senderPlatform of platforms) {
      await crossMessenger.receiveRequest({
        senderID,
        senderPlatform,
        oldContext: {},
        data: [
          {
            inputText: '',
            inputImageURL: '',
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: ''
          }
        ]
      });

      await crossMessenger.sendResponse({
        senderID,
        senderPlatform,
        visualContents: []
      });

      // Then
      verify(messengers[senderPlatform].receiveRequest(anything())).once();
      verify(messengers[senderPlatform].sendResponse(anything())).once();
    }
  });
});
