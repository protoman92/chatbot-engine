import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import {
  bridgeEmission,
  ContentSubscription,
  createLeafComposeChain,
  GenericResponse,
  KV,
  Leaf,
  mapContext,
  requireContextKeys,
  Response
} from '../../src';
import { isType } from '../../src/common/utils';
import {
  createDefaultErrorLeaf,
  createLeafWithObserver
} from '../../src/content/leaf';

const senderID = 'sender-id';

describe('Default error leaf', () => {
  interface Context extends KV<unknown> {}

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

      errorLeaf.next({ senderID, inputText, oldContext: {} });
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
    interface Context1 {
      readonly a?: number;
    }

    interface Context2 {
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
      oldContext: { a: 1000 },
      inputText: ''
    });

    // Then
    expectJs(text).to.equal('2');
  });

  it('Require context keys should work correctly', async () => {
    // Setup
    interface Context1 {
      a?: number | undefined | null;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: ({ senderID, oldContext: { a } }) => {
        return observer.next({
          senderID,
          visualContents: [
            { quickReplies: [{ text: `${a}` }], response: { text: '' } }
          ]
        });
      }
    }));

    // When
    const resultLeaf = requireContextKeys<Context1, 'a'>('a')(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = await bridgeEmission(resultLeaf)({
      senderID,
      oldContext: { a: 1 },
      inputText: ''
    });

    // Then
    expectJs(text).to.equal('1');
  });

  it('Compose chain should work', async () => {
    // Setup
    interface Context1 {
      a: number;
    }

    interface Context2 {
      b: number | undefined | null;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: ({ senderID, oldContext: { a } }) => {
        return observer.next({
          senderID,
          visualContents: [
            { quickReplies: [{ text: `${a}` }], response: { text: '' } }
          ]
        });
      }
    }));

    // When
    const resultLeaf = createLeafComposeChain()
      .forContextOfType<Context2>()
      .compose(mapContext(({ b, ...rest }) => ({ a: b || 100, ...rest })))
      .enhance(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = await bridgeEmission(resultLeaf)({
      senderID,
      oldContext: { b: null },
      inputText: ''
    });

    // Then
    expectJs(text).to.equal('100');
  });
});
