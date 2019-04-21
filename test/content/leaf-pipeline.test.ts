import expectJs from 'expect.js';
import { describe } from 'mocha';
import { anything, instance, spy, when } from 'ts-mockito';
import {
  Branch,
  Context,
  createLeafPipeline,
  createLeafWithSubject,
  KV,
  Leaf,
  LeafContentInput,
  LeafPipeline
} from '../../src';
import { joinPaths } from '../../src/common/utils';
import { enumerateLeafPipelineInputs } from '../../src/content/leaf-pipeline';

export type Pipeline = ReturnType<
  typeof import('../../src/content/leaf-pipeline')['createLeafPipeline']
>;

const senderID = 'sender-id';

describe('Supporting pipeline methods', () => {
  it('Should update context when preparing incoming context', async () => {
    // Setup
    interface TestContext extends Context {
      readonly a: number;
      readonly b: string;
    }

    const pipeline = createLeafPipeline<TestContext>();
    const currentLeafID = 'current-leaf-id';
    const prefixLeafPaths = ['a', 'b', 'c'];
    let oldContext: TestContext = { senderID, a: 1, b: '2' };

    // When
    oldContext = await pipeline.prepareIncomingContext(
      {
        currentLeafID,
        prefixLeafPaths,
        currentLeaf: createLeafWithSubject(() => ({
          isStartOfBranch: async () => true,
          checkTextConditions: () => Promise.reject(''),
          checkContextConditions: () => Promise.reject(''),
          next: () => Promise.reject('')
        })),
        parentBranch: { contextKeys: ['a', 'b'] }
      },
      oldContext
    );

    // Then
    const activeBranch = joinPaths(...prefixLeafPaths, currentLeafID);
    expectJs(oldContext).not.to.have.key('a', 'b');
    expectJs(oldContext.activeBranch).to.equal(activeBranch);
  });
});

describe('Main leaf processing', () => {
  let pipeline: Pipeline;
  let currentLeaf: Leaf<Context>;
  let pipelineInput: LeafPipeline.Input<Context>;
  let additionalParams: LeafPipeline.AdditionalParams<Context>;

  beforeEach(() => {
    currentLeaf = spy<Leaf<Context>>(
      createLeafWithSubject(() => ({
        isStartOfBranch: () => Promise.reject(''),
        checkTextConditions: () => Promise.reject(''),
        checkContextConditions: () => Promise.reject(''),
        isEndOfBranch: () => Promise.reject(''),
        next: () => Promise.reject('')
      }))
    );

    pipelineInput = spy<LeafPipeline.Input<Context>>({
      currentLeaf: instance(currentLeaf),
      currentLeafID: '',
      parentBranch: {},
      prefixLeafPaths: []
    });

    additionalParams = spy<LeafPipeline.AdditionalParams<Context>>({
      oldContext: { senderID },
      inputText: ''
    });

    pipeline = spy(createLeafPipeline());
  });

  it('Should pass if all conditions satisfied', async () => {
    // Setup
    const currentLeafID = 'current-leaf-id';
    let leafInput: LeafContentInput<Context> | undefined = undefined;
    when(pipelineInput.currentLeafID).thenReturn(currentLeafID);

    when(pipeline.prepareIncomingContext(anything(), anything())).thenResolve({
      senderID
    });

    when(currentLeaf.next(anything())).thenCall(async content => {
      leafInput = content;
    });

    // When
    await instance(pipeline).next({
      senderID,
      pipelineInput: instance(pipelineInput),
      additionalParams: instance(additionalParams)
    });

    // Then
    expectJs(leafInput).to.be.ok();
  });
});

describe('Pipeline utilities', () => {
  it('Should enumerate pipeline inputs correctly', () => {
    /// Setup
    function mapContextKeys(prefix: string) {
      return [1, 2, 3].map(key => `${prefix}.${key}`);
    }

    const typicalLeaf: Leaf<Context> = createLeafWithSubject(() => ({
      checkContextConditions: () => Promise.reject(''),
      checkTextConditions: () => Promise.reject(''),
      next: () => Promise.reject('')
    }));

    const branches: KV<Branch<Context>> = {
      b1: {
        contextKeys: mapContextKeys('b1'),
        subBranches: {
          b1_a: {
            contextKeys: mapContextKeys('b1a'),
            leaves: { b1_a_l1: typicalLeaf }
          }
        }
      },
      b2: { subBranches: undefined, leaves: undefined },
      b3: {
        contextKeys: mapContextKeys('b3'),
        subBranches: {
          b3_a: {
            subBranches: { b3_a1: {} },
            leaves: { b3_a_l1: typicalLeaf }
          }
        },
        leaves: {
          b3_l1: typicalLeaf,
          b3_l2: typicalLeaf
        }
      }
    };

    /// When
    const extractedStories = enumerateLeafPipelineInputs(branches);

    /// Then
    expectJs(extractedStories).to.eql([
      {
        currentLeaf: typicalLeaf,
        currentLeafID: 'b1_a_l1',
        parentBranch: {
          contextKeys: mapContextKeys('b1a'),
          leaves: { b1_a_l1: typicalLeaf }
        },
        prefixLeafPaths: ['b1', 'b1_a']
      },
      {
        currentLeaf: typicalLeaf,
        currentLeafID: 'b3_l1',
        parentBranch: {
          contextKeys: mapContextKeys('b3'),
          subBranches: {
            b3_a: {
              subBranches: { b3_a1: {} },
              leaves: { b3_a_l1: typicalLeaf }
            }
          },
          leaves: { b3_l1: typicalLeaf, b3_l2: typicalLeaf }
        },
        prefixLeafPaths: ['b3']
      },
      {
        currentLeaf: typicalLeaf,
        currentLeafID: 'b3_l2',
        parentBranch: {
          contextKeys: mapContextKeys('b3'),
          subBranches: {
            b3_a: {
              subBranches: { b3_a1: {} },
              leaves: { b3_a_l1: typicalLeaf }
            }
          },
          leaves: { b3_l1: typicalLeaf, b3_l2: typicalLeaf }
        },
        prefixLeafPaths: ['b3']
      },
      {
        currentLeaf: typicalLeaf,
        currentLeafID: 'b3_a_l1',
        parentBranch: {
          subBranches: { b3_a1: {} },
          leaves: { b3_a_l1: typicalLeaf }
        },
        prefixLeafPaths: ['b3', 'b3_a']
      }
    ]);
  });
});
