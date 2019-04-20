import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import {
  Context,
  createLeafSelector,
  ERROR_LEAF_ID,
  Leaf,
  LeafPipeline
} from '../../src';
import { getCurrentLeafID, joinPaths } from '../../src/common/utils';

type LeafSelector = ReturnType<
  typeof import('../../src/content/leaf-selector')['createLeafSelector']
>;

const senderID = 'sender-id';

describe('Leaf selector', () => {
  let currentLeaf: Leaf<Context>;
  let leafPipeline: LeafPipeline<Context>;
  let leafSelector: LeafSelector;

  beforeEach(() => {
    currentLeaf = spy<Leaf<Context>>({
      checkTextConditions: () => Promise.reject(''),
      checkContextConditions: () => Promise.reject(''),
      produceVisualContents: () => Promise.reject('')
    });

    leafPipeline = spy<LeafPipeline<Context>>({
      processLeaf: () => Promise.reject('')
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

  it('Selecting leaf should select first leaf that passes', async () => {
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

    when(
      leafSelector.clearPreviouslyActiveBranch(
        deepEqual(pipelineInputs),
        anything(),
        anything()
      )
    ).thenCall(async (param0, param1) => param1);

    when(leafPipeline.processLeaf(anything(), anything())).thenCall(
      async ({ currentLeafID }) => {
        if (currentLeafID === `${validLeafID}`) {
          return { newContext: { activeBranch: currentLeafID } };
        }

        return null;
      }
    );

    const oldContext: Context = { senderID };

    // When
    const { newContext } = await instance(leafSelector).selectLeaf(
      oldContext,
      ''
    );

    // Then
    const expectedCallTimes = validLeafID + 1;
    const activeBranch = newContext.activeBranch;
    const currentLeafID = getCurrentLeafID(activeBranch);
    expectJs(currentLeafID).to.equal(`${validLeafID}`);

    verify(leafPipeline.processLeaf(anything(), anything())).times(
      expectedCallTimes
    );

    verify(
      leafSelector.clearPreviouslyActiveBranch(
        deepEqual(pipelineInputs),
        deepEqual(newContext),
        anything()
      )
    ).once();
  });

  it('Should return error leaf if no leaves pass conditions', async () => {
    // Setup
    const iteration = 1000;

    const pipelineInputs: LeafPipeline.Input<Context>[] = [
      ...Array(iteration).keys()
    ].map(i => ({
      currentLeaf: instance(currentLeaf),
      currentLeafID: `${i}`,
      parentBranch: {},
      prefixLeafPaths: []
    }));

    const error = new Error('');
    when(leafSelector.enumerateInputs()).thenResolve(pipelineInputs);

    when(
      leafSelector.clearPreviouslyActiveBranch(
        deepEqual(pipelineInputs),
        anything(),
        anything()
      )
    ).thenCall(async (param0, param1) => param1);

    when(leafPipeline.processLeaf(anything(), anything())).thenThrow(error);

    // When
    const { newContext } = await instance(leafSelector).selectLeaf(
      { senderID },
      ''
    );

    // Then
    expectJs(newContext.activeBranch).to.equal(ERROR_LEAF_ID);
    verify(leafPipeline.processLeaf(anything(), anything())).times(1);

    verify(
      leafSelector.clearPreviouslyActiveBranch(
        deepEqual(pipelineInputs),
        deepEqual(newContext),
        anything()
      )
    ).once();
  });
});
