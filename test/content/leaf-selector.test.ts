import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, capture, instance, spy, verify, when } from 'ts-mockito';
import {
  Context,
  createLeafSelector,
  createLeafWithSubject,
  ERROR_LEAF_ID,
  INVALID_NEXT_RESULT,
  Leaf,
  LeafPipeline,
  LeafSelector
} from '../../src';
import { joinPaths } from '../../src/common/utils';

type TestLeafSelector = ReturnType<
  typeof import('../../src/content/leaf-selector')['createLeafSelector']
>;

const senderID = 'sender-id';

describe('Leaf selector', () => {
  let currentLeaf: Leaf<Context>;
  let leafPipeline: LeafPipeline<Context>;
  let leafSelector: TestLeafSelector;

  beforeEach(() => {
    currentLeaf = spy<Leaf<Context>>(
      createLeafWithSubject(() => ({
        checkTextConditions: () => Promise.reject(''),
        checkContextConditions: () => Promise.reject(''),
        next: () => Promise.reject(''),
        complete: () => Promise.reject('')
      }))
    );

    leafPipeline = spy<LeafPipeline<Context>>({
      next: () => Promise.reject('')
    });

    leafSelector = spy<TestLeafSelector>(
      createLeafSelector(instance(leafPipeline), {})
    );
  });

  it('Should clear prev branch if different from current branch', async () => {
    // Setup
    const previousLeafID = 'current-leaf-id';
    const previousLeafPaths = ['a', 'b', 'c'];
    const newContext: Context = { senderID, activeBranch: '1', d: 1, e: 2 };

    // When
    await instance(leafSelector).clearPreviouslyActiveBranch(
      [
        {
          currentLeaf: instance(currentLeaf),
          currentLeafID: previousLeafID,
          parentBranch: { contextKeys: ['d', 'e'] },
          prefixLeafPaths: previousLeafPaths
        }
      ],
      newContext,
      joinPaths(...previousLeafPaths, previousLeafID)
    );

    // Then
    expectJs(newContext).not.to.have.keys(['d', 'e']);
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

    when(leafSelector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    when(leafPipeline.next(anything())).thenCall(
      async ({ enumeratedLeaf: { currentLeafID } }) => {
        if (currentLeafID === `${validLeafID}`) {
          return {};
        }

        return INVALID_NEXT_RESULT;
      }
    );

    const oldContext: Context = { senderID };

    // When
    await instance(leafSelector).next({ senderID, oldContext, inputText: '' });

    // Then
    verify(leafPipeline.next(anything())).times(validLeafID + 1);
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

    when(leafSelector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(leafSelector).complete();

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

    when(leafSelector.enumerateLeaves()).thenResolve(enumeratedLeaves);

    // When
    await instance(leafSelector).subscribe({ next: async () => ({}) });

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

    when(leafSelector.enumerateLeaves()).thenResolve(enumeratedLeaves);
    when(leafSelector.getErrorLeaf()).thenResolve(errorLeaf);

    when(leafPipeline.next(anything())).thenCall(
      async ({ enumeratedLeaf: { currentLeafID } }) => {
        if (currentLeafID === ERROR_LEAF_ID) return {};
        throw error;
      }
    );

    // When
    const nextResult = await instance(leafSelector).next({
      senderID,
      oldContext: { senderID },
      inputText: ''
    });

    // Then
    const {
      enumeratedLeaf: { currentLeafID },
      additionalParams: { inputText }
    } = capture(leafPipeline.next).byCallIndex(1)[0];

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

    when(leafSelector.enumerateLeaves()).thenResolve([]);
    when(leafSelector.getErrorLeaf()).thenResolve(errorLeaf);
    when(leafPipeline.next(anything())).thenResolve({});

    // When
    await instance(leafSelector).next({
      senderID,
      oldContext: { senderID },
      inputText: ''
    });

    // Then
    const {
      enumeratedLeaf: { currentLeafID }
    } = capture(leafPipeline.next).byCallIndex(0)[0];

    expectJs(currentLeafID).to.equal(ERROR_LEAF_ID);
  });
});
