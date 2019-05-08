import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { anything, deepEqual, instance, spy, verify } from 'ts-mockito';
import { isType } from '../../src/common/utils';
import { catchErrorJustFallback } from '../../src/content/higher-order/catch-error';
import { compactMapContext } from '../../src/content/higher-order/compact-map-context';
import { mapContext } from '../../src/content/higher-order/map-context';
import { requireContextKeys } from '../../src/content/higher-order/require-context-keys';
import { createTransformChain } from '../../src/content/higher-order/transform-chain';
import {
  createDefaultErrorLeaf,
  createLeafWithObserver
} from '../../src/content/leaf';
import {
  bridgeEmission,
  createSubscription,
  STREAM_INVALID_NEXT_RESULT
} from '../../src/stream/stream';
import { ContextWithError } from '../../src/type/common';
import { Leaf } from '../../src/type/leaf';
import { Response } from '../../src/type/visual-content';

const senderID = 'sender-id';

describe('Default error leaf', () => {
  it('Should work correctly', async () => {
    // Setup
    const errorLeaf = createDefaultErrorLeaf();
    const error = new Error('some-error');

    // When
    const { visualContents } = await bridgeEmission(errorLeaf)({
      senderID,
      error,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined
    });
    // Then
    expectJs(visualContents).to.have.length(1);
    const [{ response }] = visualContents;

    if (isType<Response.Text>(response, 'text')) {
      expectJs(response.text).to.contain(error.message);
    } else {
      throw new Error('Never should have come here');
    }
  });
});

describe('Higher order functions', () => {
  it('Catch error should work correctly', async () => {
    // Setup
    const error = new Error('Something happened');

    const errorLeaf = spy<Leaf<{}>>({
      next: () => Promise.reject(error),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {}))
    });

    const fallbackLeaf = spy<Leaf<ContextWithError>>({
      next: () => Promise.resolve({}),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {}))
    });

    const transformed = createTransformChain()
      .compose(catchErrorJustFallback(instance(fallbackLeaf)))
      .enhance(instance(errorLeaf));

    // When
    const input = {
      senderID,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined,
      a: 1,
      b: 2
    };

    const nextResult = await transformed.next(input);
    await transformed.subscribe({ next: async () => ({}) });
    await transformed.complete!();

    // Then
    verify(fallbackLeaf.next(deepEqual({ ...input, error }))).once();
    verify(fallbackLeaf.complete!()).once();
    verify(fallbackLeaf.subscribe(anything())).once();
    verify(errorLeaf.complete!()).once();
    verify(errorLeaf.subscribe(anything())).once;
    expectJs(nextResult).to.eql({});
  });

  it('Map context should work correctly', async () => {
    // Setup
    interface Context1 {
      readonly a?: number;
    }

    interface Context2 {
      readonly a: number;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: async ({ senderID, a }) => {
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
      async ({ a, ...restContext }) => ({
        ...restContext,
        a: !!a ? (a === 1 ? 1 : 2) : 0
      })
    )(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = await bridgeEmission(resultLeaf)({
      senderID,
      a: 1000,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined
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
      next: ({ senderID, a }) => {
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
      a: 1,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined
    });

    // Then
    expectJs(text).to.equal('1');
  });

  it('Compact map context should work', async () => {
    // Setup
    interface Context1 {
      a: number;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: ({ senderID, a }) => {
        return observer.next({
          senderID,
          visualContents: [
            { quickReplies: [{ text: `${a}` }], response: { text: '' } }
          ]
        });
      }
    }));

    // When
    const resultLeaf = compactMapContext<Context1, Context1>(
      async ({ a, ...restContext }) => (!!a ? { a: 100, ...restContext } : null)
    )(originalLeaf);

    const nextResult1 = await resultLeaf.next({
      senderID,
      a: 0,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined
    });

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = await bridgeEmission(resultLeaf)({
      senderID,
      a: 1,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined
    });

    // Then
    expectJs(nextResult1).to.equal(STREAM_INVALID_NEXT_RESULT);
    expectJs(text).to.equal('100');
  });

  it('Transform chain should work', async () => {
    // Setup
    interface Context1 {
      a: number;
    }

    interface Context2 {
      b: number | undefined | null;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: ({ senderID, a }) => {
        return observer.next({
          senderID,
          visualContents: [
            { quickReplies: [{ text: `${a}` }], response: { text: '' } }
          ]
        });
      }
    }));

    // When
    const resultLeaf = createTransformChain()
      .forContextOfType<Context2>()
      .compose(mapContext(async ({ b, ...rest }) => ({ a: b || 100, ...rest })))
      .enhance(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = await bridgeEmission(resultLeaf)({
      senderID,
      b: null,
      inputText: '',
      inputImageURL: undefined,
      inputCoordinate: undefined
    });

    // Then
    expectJs(text).to.equal('100');
  });
});
