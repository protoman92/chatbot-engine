import expectJs from 'expect.js';
import { beforeEach, describe } from 'mocha';
import { anything, instance, spy, verify, when } from 'ts-mockito';
import { Context, createLeafSelector, Leaf, LeafPipeline } from '../../src';

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
        if (currentLeafID === `${validLeafID}`) return { currentLeafID };
        return null;
      }
    );

    const oldContext: Context = { senderID };

    // When
    const { currentLeafID } = await instance(leafSelector).selectLeaf(
      oldContext,
      ''
    );

    // Then
    const expectedCallTimes = validLeafID + 1;
    expectJs(currentLeafID).to.equal(`${validLeafID}`);

    verify(leafPipeline.processLeaf(anything(), anything())).times(
      expectedCallTimes
    );
  });
});
