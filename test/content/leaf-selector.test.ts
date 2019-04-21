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
  LeafPipeline
} from '../../src';
import { joinPaths } from '../../src/common/utils';

type LeafSelector = ReturnType<
  typeof import('../../src/content/leaf-selector')['createLeafSelector']
>;

const senderID = 'sender-id';

describe('Leaf selector', () => {
  let currentLeaf: Leaf<Context>;
  let leafPipeline: LeafPipeline<Context>;
  let leafSelector: LeafSelector;

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

    leafSelector = spy<LeafSelector>(
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

    const pipelineInputs: LeafPipeline.Input<Context>[] = [
      ...Array(iteration).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    when(leafSelector.enumerateInputs()).thenResolve(pipelineInputs);

    when(leafPipeline.next(anything())).thenCall(
      async ({ pipelineInput: { currentLeafID } }) => {
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

    const pipelineInputs: LeafPipeline.Input<Context>[] = [
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

    when(leafSelector.enumerateInputs()).thenResolve(pipelineInputs);

    // When
    await instance(leafSelector).complete();

    // Then
    expectJs(completedCount).to.equal(pipelineInputs.length);
  });

  it('Subscribing to response should merge leaf observables', async () => {
    // Setup
    const pipelineInputs: LeafPipeline.Input<Context>[] = [
      ...Array(1000).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    when(leafSelector.enumerateInputs()).thenResolve(pipelineInputs);

    // When
    await instance(leafSelector).subscribe({ next: async () => ({}) });

    // Then
    verify(currentLeaf.subscribe(anything())).times(pipelineInputs.length);
  });

  it('Erroring from receiving input should trigger error leaf', async () => {
    // Setup
    const pipelineInputs: LeafPipeline.Input<Context>[] = [
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

    when(leafSelector.enumerateInputs()).thenResolve(pipelineInputs);
    when(leafSelector.getErrorLeaf()).thenResolve(errorLeaf);

    when(leafPipeline.next(anything())).thenCall(
      async ({ pipelineInput: { currentLeafID } }) => {
        if (currentLeafID === ERROR_LEAF_ID) return {};
        throw error;
      }
    );

    // When
    const oldContext = { senderID };

    const nextResult = await instance(leafSelector).next({
      senderID,
      oldContext,
      inputText: ''
    });

    // Then
    const {
      pipelineInput: { currentLeafID },
      additionalParams: { inputText }
    } = capture(leafPipeline.next).byCallIndex(1)[0];

    expectJs(currentLeafID).to.equal(ERROR_LEAF_ID);
    expectJs(inputText).to.equal(error.message);
    expectJs(nextResult).to.eql({});
  });
});
