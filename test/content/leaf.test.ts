import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import {
  Facebook,
  thenInvoke,
  mapOutput,
  Telegram,
  VisualContent
} from '../../src';
import { DEFAULT_COORDINATES, isType } from '../../src/common/utils';
import { catchError } from '../../src/content/higher-order/catch-error';
import { firstValidResult } from '../../src/content/higher-order/first-valid';
import {
  compactMapInput,
  mapInput
} from '../../src/content/higher-order/map-input';
import { requireInputKeys } from '../../src/content/higher-order/require-keys';
import {
  createComposeChain,
  createPipeChain
} from '../../src/content/higher-order/transform-chain';
import {
  createDefaultErrorLeaf,
  createLeafForPlatforms,
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

describe('Default error leaf', () => {
  it('Should work correctly', async () => {
    // Setup
    const errorLeaf = await createDefaultErrorLeaf();
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

describe('Leaf for platforms', () => {
  let fbLeaf: Facebook.Leaf<{}>;
  let tlLeaf: Telegram.Leaf<{}>;
  let platformLeaf: Leaf<{}>;

  beforeEach(async () => {
    fbLeaf = spy<Facebook.Leaf<{}>>(
      await createLeafWithObserver(async () => ({
        next: () => Promise.reject(''),
        complete: () => Promise.reject('')
      }))
    );

    tlLeaf = spy<Telegram.Leaf<{}>>(
      await createLeafWithObserver(async () => ({
        next: () => Promise.reject(''),
        complete: () => Promise.reject('')
      }))
    );

    platformLeaf = createLeafForPlatforms({
      facebook: instance(fbLeaf),
      telegram: instance(tlLeaf)
    });
  });

  it('Should work for different platforms', async () => {
    // Setup
    when(fbLeaf.next(anything())).thenResolve({});
    when(fbLeaf.complete!()).thenResolve({});
    when(tlLeaf.next(anything())).thenResolve({});
    when(tlLeaf.complete!()).thenResolve({});

    // When
    await platformLeaf.next({
      targetID,
      targetPlatform: 'facebook',
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });

    await platformLeaf.next({
      targetID,
      targetPlatform: 'telegram',
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES
    });

    await platformLeaf.complete!();
    await platformLeaf.subscribe({ next: async () => ({}) });

    // Then
    verify(fbLeaf.next(anything())).once();
    verify(fbLeaf.complete!()).once();
    verify(fbLeaf.subscribe(anything())).once();
    verify(tlLeaf.next(anything())).once();
    verify(tlLeaf.complete!()).once();
    verify(tlLeaf.subscribe(anything())).once();
  });
});

describe('Compose chain', () => {
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

    const transformed = await createComposeChain()
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

  it('Map input should work correctly', async () => {
    // Setup
    interface Context1 {
      readonly a?: number;
    }

    interface Context2 {
      readonly a: number;
    }

    const originalLeaf: Leaf<Context1> = await createLeafWithObserver(
      async observer => ({
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
      })
    );

    // When
    const resultLeaf = await mapInput<Context1, Context2>(
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

  it('Require input keys should work correctly', async () => {
    // Setup
    interface Context1 {
      a?: number | undefined | null;
    }

    const originalLeaf: Leaf<Context1> = await createLeafWithObserver(
      async observer => ({
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
      })
    );

    // When
    const resultLeaf = await requireInputKeys<Context1, 'a'>('a')(originalLeaf);

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

  it('Compact map input should work', async () => {
    // Setup
    interface Context1 {
      a: number;
    }

    const originalLeaf: Leaf<Context1> = await createLeafWithObserver(
      async observer => ({
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
      })
    );

    // When
    const resultLeaf = await compactMapInput<Context1, Context1>(
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

  it('First successful result should work', async () => {
    // Setup
    interface Context extends WitContext<'witKey'> {
      readonly query?: string;
    }

    const transformedLeaf = await createComposeChain()
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
        await createLeafWithObserver(async observer => ({
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

  it('Compose chain should work', async () => {
    // Setup
    interface Context1 {
      a: number;
    }

    interface Context2 {
      b: number | undefined | null;
    }

    const originalLeaf: Leaf<Context1> = await createLeafWithObserver(
      async observer => ({
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
      })
    );

    // When
    const resultLeaf = await createComposeChain()
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

describe('Pipe functions', () => {
  it('Map output should work correctly', async () => {
    // Setup
    let completedCount = 0;

    const baseLeaf = await createLeafWithObserver<{}>(async observer => ({
      next: async ({ targetID, targetPlatform, inputText }) => {
        return observer.next({ targetID, targetPlatform, visualContents: [] });
      },
      complete: async () => {
        completedCount += 1;
      }
    }));

    const transformed = await createPipeChain(baseLeaf)
      .pipe<{}>(
        mapOutput(async response => ({
          ...response,
          additionalContext: { a: 1 }
        }))
      )
      .transform();

    // When
    const { additionalContext } = await bridgeEmission(transformed)({
      targetID,
      targetPlatform,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });

    !!transformed.complete && (await transformed.complete());

    // Then
    expectJs(completedCount).to.eql(1);
    expectJs(additionalContext).to.eql({ a: 1 });
  });

  it('Sequentialize should work', async () => {
    // Setup
    const sequentialLeafCount = 100;
    const invalidIndex = 50;

    const sequentialLeaves = [...Array(sequentialLeafCount).keys()].map(i =>
      spy<Leaf<{}>>({
        next: async () => {
          return i === invalidIndex ? STREAM_INVALID_NEXT_RESULT : {};
        },
        complete: async () => ({}),
        subscribe: async () => createSubscription(async () => ({}))
      })
    );

    const baseLeaf = await createLeafWithObserver(async () => ({
      next: async () => ({})
    }));

    const transformed = await createPipeChain(baseLeaf)
      .pipe(thenInvoke(...sequentialLeaves.map(leaf => instance(leaf))))
      .transform();

    // When
    await transformed.next({
      targetID,
      targetPlatform,
      inputText: '',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES,
      stickerID: ''
    });

    await transformed.complete!();
    await transformed.subscribe({ next: async () => ({}) });

    // Then
    sequentialLeaves.forEach((leaf, i) => {
      if (i <= invalidIndex) {
        verify(leaf.next(anything())).once();
      } else {
        verify(leaf.next(anything())).never();
      }

      verify(leaf.complete!()).once();
      verify(leaf.subscribe(anything())).once();
    });
  });

  it('Create leaf with pipe chain', async () => {
    // Setup
    const baseLeaf = await createLeafWithObserver(async observer => ({
      next: async ({ inputText: text, targetID, targetPlatform }) => {
        return observer.next({
          targetID,
          targetPlatform,
          visualContents: [{ content: { text, type: 'text' } }]
        });
      }
    }));

    const trasformed = await createPipeChain(baseLeaf)
      .pipe(async leaf => ({
        ...leaf,
        next: async input => {
          const previousResult = await leaf.next(input);

          if (!!previousResult) {
            throw new Error('some-error');
          }

          return STREAM_INVALID_NEXT_RESULT;
        }
      }))
      .pipe(catchError(await createDefaultErrorLeaf()))
      .transform();

    // When
    let valueDeliveredCount = 0;

    trasformed.subscribe({
      next: async () => {
        valueDeliveredCount += 1;
        return {};
      }
    });

    await trasformed.next({
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
