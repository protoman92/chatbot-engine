import expectJs from 'expect.js';
import { describe } from 'mocha';
import { anything, instance, spy, when } from 'ts-mockito';
import {
  Context,
  createLeafPipeline,
  IGNORED_TEXT_MATCH,
  Leaf,
  LeafPipeline,
  VisualContent
} from '../../src';

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
