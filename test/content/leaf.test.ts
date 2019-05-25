import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { anything, deepEqual, instance, spy, verify } from 'ts-mockito';
import { Facebook, VisualContent } from '../../src';
import { DEFAULT_COORDINATES, isType } from '../../src/common/utils';
import { catchError } from '../../src/content/higher-order/catch-error';
import { firstValidResult } from '../../src/content/higher-order/first-valid';
import {
  compactMapInput,
  mapInput
} from '../../src/content/higher-order/map-input';
import { requireInputKeys } from '../../src/content/higher-order/require-keys';
import {
  createTransformChain,
  createLeafWithPipe
} from '../../src/content/higher-order/transform-chain';
import {
  createDefaultErrorLeaf,
  createLeafWithObserver
} from '../../src/content/leaf';
import {
  bridgeEmission,
  createSubscription,
  STREAM_INVALID_NEXT_RESULT
} from '../../src/stream/stream';
import { ErrorContext } from '../../src/type/common';
import { Leaf } from '../../src/type/leaf';
import { WitContext } from '../../src/type/wit';

const targetID = 'target-id';
const targetPlatform = 'facebook' as const;

describe('Utility functions', () => {
  it('Create leaf with pipe', async () => {
    // Setup
    const baseLeaf = createLeafWithObserver(observer => ({
      next: async ({ inputText: text, targetID, targetPlatform }) => {
        return observer.next({
          targetID,
          targetPlatform,
          visualContents: [{ content: { text, type: 'text' } }]
        });
      }
    }));

    const leafWithPipe = createLeafWithPipe(baseLeaf)
      .pipe(leaf => ({
        ...leaf,
        next: async input => {
          const previousResult = await leaf.next(input);

          if (!!previousResult) {
            throw new Error('some-error');
          }

          return STREAM_INVALID_NEXT_RESULT;
        }
      }))
      .pipe(catchError(createDefaultErrorLeaf()));

    // When
    let valueDeliveredCount = 0;

    leafWithPipe.subscribe({
      next: async () => {
        valueDeliveredCount += 1;
        return {};
      }
    });

    await leafWithPipe.next({
      targetID,
      targetPlatform,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: '',
      error: new Error('')
    });

    // Then
    expectJs(valueDeliveredCount).to.eql(2);
  });
});

describe('Default error leaf', () => {
  it('Should work correctly', async () => {
    // Setup
    const errorLeaf = createDefaultErrorLeaf();
    const error = new Error('some-error');

    // When
    const { visualContents } = await bridgeEmission(errorLeaf)({
      targetID,
      targetPlatform,
      error,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });
    // Then
    expectJs(visualContents).to.have.length(1);
    const [{ content: response }] = visualContents;

    if (isType<VisualContent.MainContent.Text>(response, 'text')) {
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

    const fallbackLeaf = spy<Leaf<ErrorContext>>({
      next: () => Promise.resolve({}),
      complete: () => Promise.resolve({}),
      subscribe: () => Promise.resolve(createSubscription(async () => {}))
    });

    const transformed = createTransformChain()
      .compose(catchError(instance(fallbackLeaf)))
      .transform(instance(errorLeaf));

    // When
    const input = {
      targetID,
      targetPlatform,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: '',
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
      next: async ({ targetID, a }) => {
        return observer.next({
          targetID,
          targetPlatform,
          visualContents: [
            {
              quickReplies: [{ type: 'text', text: `${a}` }],
              content: { type: 'text', text: '' }
            }
          ]
        });
      }
    }));

    // When
    const resultLeaf = mapInput<Context1, Context2>(
      async ({ a, ...restContext }) => ({
        ...restContext,
        a: !!a ? (a === 1 ? 1 : 2) : 0
      })
    )(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = (await bridgeEmission(resultLeaf)({
      targetID,
      targetPlatform,
      a: 1000,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    })) as Facebook.GenericResponse<Context2>;

    // Then
    expectJs(text).to.equal('2');
  });

  it('Require context keys should work correctly', async () => {
    // Setup
    interface Context1 {
      a?: number | undefined | null;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: ({ targetID, a }) => {
        return observer.next({
          targetID,
          targetPlatform,
          visualContents: [
            {
              quickReplies: [{ type: 'text', text: `${a}` }],
              content: { type: 'text', text: '' }
            }
          ]
        });
      }
    }));

    // When
    const resultLeaf = requireInputKeys<Context1, 'a'>('a')(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = (await bridgeEmission(resultLeaf)({
      targetID,
      targetPlatform,
      a: 1,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    })) as Facebook.GenericResponse<Context1>;

    // Then
    expectJs(text).to.equal('1');
  });

  it('Compact map context should work', async () => {
    // Setup
    interface Context1 {
      a: number;
    }

    const originalLeaf: Leaf<Context1> = createLeafWithObserver(observer => ({
      next: ({ targetID, a }) => {
        return observer.next({
          targetID,
          targetPlatform,
          visualContents: [
            {
              quickReplies: [{ type: 'text', text: `${a}` }],
              content: { type: 'text', text: '' }
            }
          ]
        });
      }
    }));

    // When
    const resultLeaf = compactMapInput<Context1, Context1>(
      async ({ a, ...restContext }) => (!!a ? { a: 100, ...restContext } : null)
    )(originalLeaf);

    const nextResult1 = await resultLeaf.next({
      targetID,
      targetPlatform,
      a: 0,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = (await bridgeEmission(resultLeaf)({
      targetID,
      targetPlatform,
      a: 1,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    })) as Facebook.GenericResponse<Context1>;

    // Then
    expectJs(nextResult1).to.equal(STREAM_INVALID_NEXT_RESULT);
    expectJs(text).to.equal('100');
  });

  it('First successful should work', async () => {
    // Setup
    interface Context extends WitContext<'witKey'> {
      readonly query?: string;
    }

    const transformedLeaf = createTransformChain()
      .forContextOfType<Context>()
      .compose(
        firstValidResult<Context, Context>(
          compactMapInput(async ({ inputText, ...restInput }) => {
            if (!inputText) return null;
            return { ...restInput, inputText, query: 'first_transformer' };
          }),
          compactMapInput(
            async ({
              witEntities: { witKey: [{ value }] = [{ value: '' }] },
              ...restInput
            }) => {
              if (!value) return null;

              return {
                ...restInput,
                witEntities: {},
                query: 'second_transformer'
              };
            }
          )
        )
      )
      .transform(
        createLeafWithObserver(observer => ({
          next: async ({ targetID, query }) => {
            await observer.next({
              targetID,
              targetPlatform,
              additionalContext: { query },
              visualContents: []
            });

            return {};
          }
        }))
      );

    // When
    const { additionalContext } = await bridgeEmission(transformedLeaf)({
      targetID,
      targetPlatform,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: '',
      witEntities: {
        witKey: [{ confidence: 1, value: 'witValue', type: 'value' }]
      }
    });

    // Then
    expectJs(additionalContext).to.eql({ query: 'second_transformer' });
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
      next: ({ targetID, a }) => {
        return observer.next({
          targetID,
          targetPlatform,
          visualContents: [
            {
              quickReplies: [{ type: 'text', text: `${a}` }],
              content: { type: 'text', text: '' }
            }
          ]
        });
      }
    }));

    // When
    const resultLeaf = createTransformChain()
      .forContextOfType<Context2>()
      .compose(mapInput(async ({ b, ...rest }) => ({ a: b || 100, ...rest })))
      .transform(originalLeaf);

    const {
      visualContents: [{ quickReplies: [{ text }] = [{ text: '' }] }]
    } = (await bridgeEmission(resultLeaf)({
      targetID,
      targetPlatform,
      b: null,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    })) as Facebook.GenericResponse<Context2>;

    // Then
    expectJs(text).to.equal('100');
  });
});
