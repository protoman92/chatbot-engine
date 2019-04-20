import expectJs from 'expect.js';
import { describe } from 'mocha';
import { createLeafPipeline } from '../../src/content/leaf-pipeline';
import { Context } from '../../src/type/common';

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
});
