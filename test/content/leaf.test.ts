import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import {
  bridgeEmission,
  ContentSubscription,
  Context,
  GenericResponse,
  Leaf,
  mapContext,
  Response
} from '../../src';
import { isType } from '../../src/common/utils';
import {
  createDefaultErrorLeaf,
  createLeafWithObserver
} from '../../src/content/leaf';

const senderID = 'sender-id';

describe('Default error leaf', () => {
  it('Should work correctly', async () => {
    // Setup
    const errorLeaf = createDefaultErrorLeaf();
    const inputText = 'some-error';

    // When
    const { senderID: receivedSenderID, visualContents } = await new Promise<
      GenericResponse<Context>
    >(async resolve => {
      let subscription: ContentSubscription;
      let receivedNext = false;

      subscription = await errorLeaf.subscribe({
        next: async content => {
          resolve(content);
          receivedNext = true;
          !!subscription && (await subscription.unsubscribe());
          return {};
        }
      });

      errorLeaf.next({ senderID, inputText, oldContext: { senderID } });
      receivedNext && !!subscription && (await subscription.unsubscribe());
    });

    // Then
    expectJs(receivedSenderID).to.equal(senderID);
    expectJs(visualContents).to.have.length(1);
    const [{ response }] = visualContents;

    if (isType<Response.Text>(response, 'text')) {
      expectJs(response.text).to.contain(inputText);
    } else {
      throw new Error('Never should have come here');
    }
  });
});

describe('Higher order functions', () => {
  it('Map context should work correctly', async () => {
    // Setup
    interface Context1 extends Context {
      readonly a?: number;
    }

    interface Context2 extends Context {
      readonly a: number;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: async ({ senderID, oldContext: { a } }) => {
        return observer.next({
          senderID,
          visualContents: [
            { quickReplies: [{ text: `${a}` }], response: { text: '' } }
          ]
        });
      }
    }));

    // When
    const resultLeaf = mapContext<Context1, Context2>(
      ({ a, ...restContext }) => ({
        ...restContext,
        a: !!a ? (a === 1 ? 1 : 2) : 0
      })
    )(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = await bridgeEmission(resultLeaf)({
      senderID,
      oldContext: { senderID, a: 1000 },
      inputText: ''
    });

    // Then
    expectJs(text).to.equal('2');
  });
});
