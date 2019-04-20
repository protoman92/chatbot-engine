import expectJs from 'expect.js';
import { describe } from 'mocha';
import { anything, instance, spy, when } from 'ts-mockito';
import {
  Branch,
  Context,
  createLeafPipeline,
  IGNORED_TEXT_MATCH,
  KV,
  Leaf,
  LeafPipeline,
  VisualContent
} from '../../src';
import { enumerateLeafPipelineInputs } from '../../src/content/leaf-pipeline';

type Pipeline = ReturnType<
  typeof import('../../src/content/leaf-pipeline')['createLeafPipeline']
>;

const senderID = 'sender-id';
const activeBranch = 'active-branch';

describe('Supporting pipeline methods', () => {
  it('Should update context when preparing incoming context', async () => {
    // Setup
    interface TestContext extends Context {
      readonly a: number;
      readonly b: string;
    }

    const pipeline = createLeafPipeline<TestContext>();
    let oldContext: TestContext = { senderID, a: 1, b: '2' };

    // When
    oldContext = await pipeline.prepareIncomingContext(
      {
        parentBranch: {
          contextKeys: ['a', 'b']
        },
        currentLeaf: {
          isStartOfBranch: async () => true,
          checkTextConditions: () => Promise.reject(''),
          checkContextConditions: () => Promise.reject(''),
          produceVisualContent: () => Promise.reject('')
        }
      },
      oldContext
    );

    // Then
    expectJs(oldContext).not.to.have.key('a', 'b');
  });

  it('Should update context when preparing outgoing context', async () => {
    // Setup
    interface TestContext extends Context {
      readonly a: number;
      readonly b: string;
    }

    const pipeline = createLeafPipeline<TestContext>();
    let oldContext: TestContext = { senderID, activeBranch, a: 1, b: '2' };

    // When
    oldContext = await pipeline.prepareOutgoingContext(
      {
        parentBranch: {
          contextKeys: ['a', 'b']
        },
        currentLeaf: {
          checkTextConditions: () => Promise.reject(''),
          checkContextConditions: () => Promise.reject(''),
          produceVisualContent: () => Promise.reject(''),
          isEndOfBranch: async () => true
        }
      },
      oldContext
    );

    // Then
    expectJs(oldContext).not.to.have.key('activeBranch', 'a', 'b');
  });

  it('Extracting text matches with valid input text', async () => {
    // Setup
    const pipeline = createLeafPipeline();
    const textMatch = 'text-match';

    // When
    const { allTextMatches, lastTextMatch } = await pipeline.extractTextMatches(
      { checkTextConditions: async () => textMatch },
      'input-text'
    );

    // Then
    expectJs(allTextMatches).to.eql([textMatch]);
    expectJs(lastTextMatch).to.equal(textMatch);
  });

  it('Extracting text matches with invalid input text', async () => {
    // Setup
    const pipeline = createLeafPipeline();
    const textMatch = 'text-match';

    // When
    const { allTextMatches, lastTextMatch } = await pipeline.extractTextMatches(
      { checkTextConditions: async () => textMatch },
      ''
    );

    // Then
    expectJs(allTextMatches).to.eql([IGNORED_TEXT_MATCH]);
    expectJs(lastTextMatch).to.equal(IGNORED_TEXT_MATCH);
  });

  it('Extracting text matches with boolean text matches', async () => {
    // Setup
    const pipeline = createLeafPipeline();

    // When
    const { allTextMatches, lastTextMatch } = await pipeline.extractTextMatches(
      { checkTextConditions: async () => true },
      'input-text'
    );

    // Then
    expectJs(allTextMatches).to.eql([]);
    expectJs(lastTextMatch).to.not.be.ok();
  });
});

describe('Main leaf processing', () => {
  let pipeline: Pipeline;
  let currentLeaf: Leaf<Context>;
  let pipelineInput: LeafPipeline.Input<Context>;
  let additionalParams: LeafPipeline.AdditionalParams<Context>;

  beforeEach(() => {
    pipeline = spy(createLeafPipeline());

    currentLeaf = spy<Leaf<Context>>({
      isStartOfBranch: () => Promise.reject(''),
      checkTextConditions: () => Promise.reject(''),
      checkContextConditions: () => Promise.reject(''),
      produceVisualContent: () => Promise.reject(''),
      isEndOfBranch: () => Promise.reject(''),
      isIntermediate: () => Promise.reject('')
    });

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
  });

  it('Should fail if context checks fail', async () => {
    // Setup
    when(currentLeaf.checkContextConditions(anything())).thenResolve(false);

    when(pipeline.prepareIncomingContext(anything(), anything())).thenResolve({
      senderID
    });

    // When
    const result = await instance(pipeline).processLeaf(
      instance(pipelineInput),
      instance(additionalParams)
    );

    // Then
    expectJs(result).not.to.be.ok();
  });

  it('Should fail if no text match found', async () => {
    // Setup
    when(currentLeaf.checkContextConditions(anything())).thenResolve(true);

    when(pipeline.prepareIncomingContext(anything(), anything())).thenResolve({
      senderID
    });

    when(pipeline.extractTextMatches(anything(), anything())).thenResolve({
      allTextMatches: [],
      lastTextMatch: ''
    });

    // When
    const result = await instance(pipeline).processLeaf(
      instance(pipelineInput),
      instance(additionalParams)
    );

    // Then
    expectJs(result).not.to.be.ok();
  });

  it('Should fail if no outgoing contents found', async () => {
    // Setup
    when(currentLeaf.checkContextConditions(anything())).thenResolve(true);

    when(pipeline.prepareIncomingContext(anything(), anything())).thenResolve({
      senderID
    });

    when(pipeline.extractTextMatches(anything(), anything())).thenResolve({
      allTextMatches: [],
      lastTextMatch: 'last-text-match'
    });

    when(currentLeaf.produceVisualContent(anything())).thenResolve({
      newContext: { senderID },
      visualContents: []
    });

    // When
    const result = await instance(pipeline).processLeaf(
      instance(pipelineInput),
      instance(additionalParams)
    );

    // Then
    expectJs(result).not.to.be.ok();
  });

  it('Should pass if all conditions satisfied', async () => {
    // Setup
    const currentLeafID = 'current-leaf-id';
    when(pipelineInput.currentLeafID).thenReturn(currentLeafID);

    when(currentLeaf.checkContextConditions(anything())).thenResolve(true);

    when(pipeline.prepareIncomingContext(anything(), anything())).thenResolve({
      senderID
    });

    when(pipeline.extractTextMatches(anything(), anything())).thenResolve({
      allTextMatches: [],
      lastTextMatch: 'last-text-match'
    });

    const newContext: Context = { senderID, a: '1', b: '2' };

    const visualContents: VisualContent[] = [
      { quickReplies: [{ text: 'quick-reply' }], response: { text: 'text' } }
    ];

    when(currentLeaf.produceVisualContent(anything())).thenResolve({
      newContext,
      visualContents
    });

    when(pipeline.prepareOutgoingContext(anything(), anything())).thenResolve(
      newContext
    );

    // When
    const result = await instance(pipeline).processLeaf(
      instance(pipelineInput),
      instance(additionalParams)
    );

    // Then
    expectJs(result).to.eql({ currentLeafID, newContext, visualContents });
  });
});

describe('Pipeline utilities utilities', () => {
  it('Should enumerate pipeline inputs correctly', () => {
    /// Setup
    function mapContextKeys(prefix: string) {
      return [1, 2, 3].map(val => `${prefix}.${val}`);
    }

    const typicalLeaf: Leaf<Context> = {
      checkContextConditions: () => Promise.reject(''),
      checkTextConditions: () => Promise.reject(''),
      produceVisualContent: () => Promise.reject('')
    };

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
