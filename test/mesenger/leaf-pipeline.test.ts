import expectJs from 'expect.js';
import { describe } from 'mocha';
import {
  createLeafPipeline,
  IGNORED_TEXT_MATCH
} from '../../src/content/leaf-pipeline';
import { Context } from '../../src/type/common';

export type Pipeline = ReturnType<
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
          produceOutgoingContent: () => Promise.reject('')
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
          produceOutgoingContent: () => Promise.reject(''),
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
