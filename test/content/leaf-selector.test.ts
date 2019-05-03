import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, capture, instance, spy, verify, when } from 'ts-mockito';
import {
  createLeafSelector,
  createLeafWithObserver,
  ERROR_LEAF_ID,
  INVALID_NEXT_RESULT,
  KV,
  Leaf,
  LeafSelector
} from '../../src';

type TestLeafSelector = ReturnType<
  typeof import('../../src/content/leaf-selector')['createLeafSelector']
>;

const senderID = 'sender-id';

describe('Leaf selector', () => {
  interface Context extends KV<unknown> {}

  let currentLeaf: Leaf<Context>;
  let selector: TestLeafSelector;

  beforeEach(() => {
    currentLeaf = spy<Leaf<Context>>(
      createLeafWithObserver(() => ({
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

    const enumeratedLeaves: LeafSelector.EnumeratedLeaf<Context>[] = [
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

        return INVALID_NEXT_RESULT;
      }
    );

    // When
    await instance(selector).next({
      senderID,
      oldContext: {},
      inputText: '',
      inputImageURL: undefined,
      inputCoordinates: undefined
    });

    // Then
    verify(selector.triggerLeafContent(anything(), anything())).times(
      validLeafID + 1
    );
  });

  it('Completing stream should trigger complete from all leaves', async () => {
    // Setup
    let completedCount = 0;

    const enumeratedLeaves: LeafSelector.EnumeratedLeaf<Context>[] = [
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
    const enumeratedLeaves: LeafSelector.EnumeratedLeaf<Context>[] = [
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

  it('Erroring from receiving input should trigger error leaf', async () => {
    // Setup
    const enumeratedLeaves: LeafSelector.EnumeratedLeaf<Context>[] = [
      ...Array(1000).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    const errorLeaf: Leaf<Context> = {
      next: () => Promise.reject(''),
      subscribe: () => Promise.reject('')
    };

    const error = new Error('Something happened!');

    when(selector.enumerateLeaves()).thenResolve(enumeratedLeaves);
    when(selector.getErrorLeaf()).thenResolve(errorLeaf);

    when(selector.triggerLeafContent(anything(), anything())).thenCall(
      async ({ currentLeafID }) => {
        if (currentLeafID === ERROR_LEAF_ID) return {};
        throw error;
      }
    );

    // When
    const nextResult = await instance(selector).next({
      senderID,
      oldContext: {},
      inputText: '',
      inputImageURL: undefined,
      inputCoordinates: undefined
    });

    // Then
    const [{ currentLeafID }, { inputText }] = capture(
      selector.triggerLeafContent
    ).byCallIndex(1);

    expectJs(currentLeafID).to.equal(ERROR_LEAF_ID);
    expectJs(inputText).to.equal(error.message);
    expectJs(nextResult).to.eql({});
  });

  it('Should throw error if no enumerated leaves found', async () => {
    // Setup
    const errorLeaf: Leaf<Context> = {
      next: () => Promise.reject(''),
      subscribe: () => Promise.reject('')
    };

    when(selector.enumerateLeaves()).thenResolve([]);
    when(selector.getErrorLeaf()).thenResolve(errorLeaf);
    when(selector.triggerLeafContent(anything(), anything())).thenResolve({});

    // When
    await instance(selector).next({
      senderID,
      oldContext: {},
      inputText: '',
      inputImageURL: undefined,
      inputCoordinates: undefined
    });

    // Then
    const [{ currentLeafID }] = capture(
      selector.triggerLeafContent
    ).byCallIndex(0);

    expectJs(currentLeafID).to.equal(ERROR_LEAF_ID);
  });
});
