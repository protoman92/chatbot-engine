import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, instance, spy, verify, when } from 'ts-mockito';
import { DEFAULT_COORDINATES } from '../../src/common/utils';
import { createLeafWithObserver } from '../../src/content/leaf';
import { createLeafSelector } from '../../src/content/leaf-selector';
import { STREAM_INVALID_NEXT_RESULT } from '../../src/stream/stream';
import { Leaf } from '../../src/type/leaf';

type TestLeafSelector = ReturnType<
  typeof import('../../src/content/leaf-selector')['createLeafSelector']
>;

const targetID = 'target-id';
const targetPlatform = 'facebook';

describe('Leaf selector', () => {
  interface Context {}

  let currentLeaf: Leaf<Context>;
  let selector: TestLeafSelector;

  beforeEach(async () => {
    currentLeaf = spy<Leaf<Context>>(
      await createLeafWithObserver(async () => ({
        checkTextConditions: () => Promise.reject(''),
        checkContextConditions: () => Promise.reject(''),
        next: () => Promise.reject(''),
        complete: () => Promise.reject('')
      }))
    );

    selector = spy<TestLeafSelector>(createLeafSelector({}));
  });

  it('Selecting leaf should stop at first leaf that passes', async () => {
    // Setup
    const iteration = 1000;
    const validLeafID = 500;

    const enumeratedLeaves: Leaf.Enumerated<Context>[] = [
      ...Array(iteration).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    when(selector.triggerLeafContent(anything(), anything())).thenCall(
      async ({ currentLeafID }) => {
        if (currentLeafID === `${validLeafID}`) {
          return {};
        }

        return STREAM_INVALID_NEXT_RESULT;
      }
    );

    // When
    await instance(selector).next({
      targetID,
      targetPlatform,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });

    // Then
    verify(selector.triggerLeafContent(anything(), anything())).times(
      validLeafID + 1
    );
  });

  it('Completing stream should trigger complete from all leaves', async () => {
    // Setup
    let completedCount = 0;

    const enumeratedLeaves: Leaf.Enumerated<Context>[] = [
      ...Array(1000).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    !!currentLeaf.complete &&
      when(currentLeaf.complete()).thenCall(async () => {
        completedCount += 1;
      });

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(selector).complete();

    // Then
    expectJs(completedCount).to.equal(enumeratedLeaves.length);
  });

  it('Subscribing to response should merge leaf observables', async () => {
    // Setup
    const enumeratedLeaves: Leaf.Enumerated<Context>[] = [
      ...Array(1000).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(selector).subscribe({ next: async () => ({}) });

    // Then
    verify(currentLeaf.subscribe(anything())).times(enumeratedLeaves.length);
  });

  it('Should throw error if no enumerated leaves found', async () => {
    // Setup
    when(selector.enumerateLeaves()).thenResolve([]);
    when(selector.triggerLeafContent(anything(), anything())).thenResolve({});

    // When
    try {
      await instance(selector).next({
        targetID,
        targetPlatform,
        inputText: '',
        inputImageURL: '',
        inputCoordinate: DEFAULT_COORDINATES,
        stickerID: ''
      });

      // Then
      throw new Error('Never should have come here');
    } catch {}
  });
});
