import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, instance, spy, verify, when } from 'ts-mockito';
import {
  Context,
  createLeafSelector,
  ERROR_LEAF_ID,
  Leaf,
  LeafPipeline
} from '../../src';
import { getCurrentLeafID } from '../../src/common/utils';

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
      produceVisualContent: () => Promise.reject('')
    });

    leafPipeline = spy<LeafPipeline<Context>>({
      processLeaf: () => Promise.reject('')
    });

    leafSelector = spy<LeafSelector>(
      createLeafSelector(instance(leafPipeline), {})
    );
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
    const {
      newContext: { activeBranch }
    } = await instance(leafSelector).selectLeaf(oldContext, '');

    // Then
    const expectedCallTimes = validLeafID + 1;
    const currentLeafID = getCurrentLeafID(activeBranch);
    expectJs(currentLeafID).to.equal(`${validLeafID}`);

    verify(leafPipeline.processLeaf(anything(), anything())).times(
      expectedCallTimes
    );
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
    when(leafPipeline.processLeaf(anything(), anything())).thenThrow(error);

    // When
    const {
      newContext: { activeBranch }
    } = await instance(leafSelector).selectLeaf({ senderID }, '');

    // Then
    expectJs(activeBranch).to.equal(ERROR_LEAF_ID);
    verify(leafPipeline.processLeaf(anything(), anything())).times(1);
  });
});
