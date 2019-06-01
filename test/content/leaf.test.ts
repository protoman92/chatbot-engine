import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { Omit } from 'ts-essentials';
import { anything, instance, spy, verify, when } from 'ts-mockito';
import { Facebook, Telegram, VisualContent } from '../../src';
import { DEFAULT_COORDINATES, isType } from '../../src/common/utils';
import {
  createDefaultErrorLeaf,
  createLeafForPlatforms
} from '../../src/content/leaf';
import { bridgeEmission } from '../../src/stream/stream';
import { Leaf } from '../../src/type/leaf';

const targetID = 'target-id';
const targetPlatform = 'facebook';

describe('Default error leaf', () => {
  it('Should work correctly', async () => {
    // Setup
    const errorLeaf = await createDefaultErrorLeaf();
    const error = new Error('some-error');

    // When
    const { visualContents } = await bridgeEmission(errorLeaf)({
      targetID,
      targetPlatform,
      error,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });
    // Then
    expectJs(visualContents).to.have.length(1);
    const [{ content: response }] = visualContents;

    if (isType<VisualContent.MainContent.Text>(response, 'text')) {
      expectJs(response.text).to.contain(error.message);
    } else {
      throw new Error('Never should have come here');
    }
  });
});

describe('Leaf for platforms', () => {
  let fbLeaf: Omit<Facebook.Leaf<{}>, 'subscribe'>;
  let tlLeaf: Omit<Telegram.Leaf<{}>, 'subscribe'>;
  let platformLeaf: Leaf<{}>;

  beforeEach(async () => {
    fbLeaf = spy<Omit<Facebook.Leaf<{}>, 'subscribe'>>({
      next: () => Promise.reject(''),
      complete: () => Promise.reject('')
    });

    tlLeaf = spy<Omit<Telegram.Leaf<{}>, 'subscribe'>>({
      next: () => Promise.reject(''),
      complete: () => Promise.reject('')
    });

    platformLeaf = await createLeafForPlatforms(async () => ({
      facebook: instance(fbLeaf),
      telegram: instance(tlLeaf)
    }));
  });

  it('Should work for different platforms', async () => {
    // Setup
    when(fbLeaf.next(anything())).thenResolve({});
    when(fbLeaf.complete!()).thenResolve({});
    when(tlLeaf.next(anything())).thenResolve({});
    when(tlLeaf.complete!()).thenResolve({});

    // When
    await platformLeaf.next({
      targetID,
      targetPlatform: 'facebook',
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });

    await platformLeaf.next({
      targetID,
      targetPlatform: 'telegram',
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES
    });

    await platformLeaf.complete!();
    await platformLeaf.subscribe({ next: async () => ({}) });

    // Then
    verify(fbLeaf.next(anything())).once();
    verify(fbLeaf.complete!()).once();
    verify(tlLeaf.next(anything())).once();
    verify(tlLeaf.complete!()).once();
  });
});
