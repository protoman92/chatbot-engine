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
  CrossPlatformMessengerConfigs,
  Facebook,
  GenericRequest,
  SupportedPlatform,
  Telegram
} from '../../src';
import {
  createCrossPlatformBatchMessenger,
  createMessenger
} from '../../src/messenger/generic-messenger';
import { PlatformCommunicator } from '../../src/type/communicator';
import { Leaf } from '../../src/type/leaf';
import { GenericResponse } from '../../src/type/response';

const targetID = 'target-id';
const targetPlatform = 'facebook' as const;

describe('Generic unit messenger', () => {
  let leafSelector: Leaf<{}>;
  let communicator: PlatformCommunicator<unknown>;

  beforeEach(async () => {
    leafSelector = spy<Leaf<{}>>({
      next: () => Promise.reject(''),
      subscribe: () => Promise.reject('')
    });

    communicator = spy<PlatformCommunicator<unknown>>({
      sendResponse: () => Promise.reject(''),
      setTypingIndicator: () => Promise.reject('')
    });
  });

  it('Should trigger send with valid response', async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(communicator.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

    // When
    const unitMessenger = spy(
      await createMessenger({
        targetPlatform,
        leafSelector: instance(leafSelector),
        communicator: instance(communicator),
        mapRequest: async () => [],
        mapResponse: async () => platformResponses
      })
    );

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const response: GenericResponse<{}> = {
      targetID,
      targetPlatform,
      visualContents: []
    };

    await next(response);

    // Then
    expectJs(complete).to.be.ok();
    verify(unitMessenger.sendResponse(deepEqual(response))).once();

    platformResponses.forEach(response => {
      verify(communicator.sendResponse(deepEqual(response))).once();
    });
  });

  it('Should not trigger send without matching target platform', async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(communicator.sendResponse(anything())).thenResolve();
    const platformResponses = [{ a: 1 }, { b: 2 }];

    // When
    const unitMessenger = spy(
      await createMessenger({
        targetPlatform: 'telegram',
        leafSelector: instance(leafSelector),
        communicator: instance(communicator),
        mapRequest: async () => [],
        mapResponse: async () => platformResponses
      })
    );

    const { next, complete } = capture(leafSelector.subscribe).first()[0];

    const nextResult = await next({
      targetID,
      targetPlatform,
      visualContents: []
    });

    // Then
    expectJs(nextResult).to.eql(undefined);
    expectJs(complete).to.be.ok();
    verify(unitMessenger.sendResponse(anything())).never();
  });

  it('Should process input when receiving request', async () => {
    // Setup
    when(leafSelector.subscribe(anything())).thenResolve();
    when(leafSelector.next(anything())).thenResolve();
    const oldContext = { a: 1, b: 2 };

    const data: readonly Facebook.GenericRequest.Data[] = [
      {
        targetPlatform,
        inputText: 'text-1',
        inputImageURL: 'image-1',
        inputCoordinate: { lat: 0, lng: 0 },
        stickerID: ''
      },
      {
        targetPlatform,
        inputText: 'text-2',
        inputImageURL: 'image-2',
        inputCoordinate: { lat: 1, lng: 1 },
        stickerID: ''
      }
    ];

    // When
    const unitMessenger = await createMessenger({
      targetPlatform,
      leafSelector: instance(leafSelector),
      communicator: instance(communicator),
      mapRequest: async () => [] as readonly GenericRequest<{}>[],
      mapResponse: async () => []
    });

    await unitMessenger.receiveRequest({
      targetID,
      targetPlatform,
      oldContext,
      data
    });

    // Then
    data.forEach(datum =>
      verify(
        leafSelector.next(
          deepEqual({ ...datum, ...oldContext, targetID, targetPlatform })
        )
      ).once()
    );
  });
});

describe('Cross platform unit messenger', () => {
  let fbMessenger: Facebook.Messenger<{}>;
  let tlMessenger: Telegram.Messenger<{}>;
  let messengers: CrossPlatformMessengerConfigs<{}>;
  let messengerInstances: CrossPlatformMessengerConfigs<{}>;

  beforeEach(() => {
    fbMessenger = spy<Facebook.Messenger<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({})
    });

    tlMessenger = spy<Telegram.Messenger<{}>>({
      generalizeRequest: () => Promise.resolve([]),
      receiveRequest: () => Promise.resolve({}),
      sendResponse: () => Promise.resolve({})
    });

    messengers = { facebook: fbMessenger, telegram: tlMessenger };

    messengerInstances = Object.entries(messengers)
      .map(([key, value]) => ({
        [key]: instance(value)
      }))
      .reduce((acc, item) => ({ ...acc, ...item })) as typeof messengers;
  });

  it('Should invoke correct messenger', async () => {
    // Setup
    when(fbMessenger.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        targetPlatform: 'facebook',
        oldContext: {},
        data: []
      }
    ]);

    when(tlMessenger.generalizeRequest(anything())).thenResolve([
      {
        targetID,
        targetPlatform: 'telegram' as const,
        oldContext: {},
        data: [],
        telegramUser: {
          id: 0,
          first_name: '',
          last_name: '',
          username: '',
          language_code: 'en' as const,
          is_bot: false
        }
      }
    ]);

    const platforms = Object.keys(messengers) as readonly SupportedPlatform[];

    // When
    for (const targetPlatform of platforms) {
      const crossMessenger = createCrossPlatformBatchMessenger(
        messengerInstances,
        () => targetPlatform
      );

      await crossMessenger.processPlatformRequest({});

      // Then
      verify(messengers[targetPlatform].generalizeRequest(anything())).once();
      verify(messengers[targetPlatform].receiveRequest(anything())).once();
    }
  });
});
