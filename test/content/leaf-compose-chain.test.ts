import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { anything, deepEqual, instance, spy, verify } from 'ts-mockito';
import {
  createComposeChain,
  createLeafWithObserver,
  ErrorContext,
  Facebook,
  higherOrderAnyTransformer,
  higherOrderCatchError,
  higherOrderCompactMapInput,
  higherOrderFilterInput,
  higherOrderMapInput,
  higherOrderRequireInputKeys,
  Leaf,
  WitContext
} from '../../src';
import { DEFAULT_COORDINATES } from '../../src/common/utils';
import { bridgeEmission, createSubscription } from '../../src/stream/stream';

const targetID = 'target-id';
const targetPlatform = 'facebook' as const;

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
      .compose(higherOrderCatchError(instance(fallbackLeaf)))
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
    const resultLeaf = await higherOrderMapInput<Context1, Context2>(
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
    const resultLeaf = await higherOrderRequireInputKeys<Context1, 'a'>('a')(
      originalLeaf
    );

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
    const resultLeaf = await higherOrderCompactMapInput<Context1, Context1>(
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
    expectJs(nextResult1).to.equal(undefined);
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
        higherOrderAnyTransformer<Context, Context>(
          higherOrderCompactMapInput(async ({ inputText, ...restInput }) => {
            if (!inputText) return null;
            return { ...restInput, inputText, query: 'first_transformer' };
          }),
          higherOrderCompactMapInput(
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
      .compose(
        higherOrderMapInput(async ({ b, ...rest }) => {
          return { a: b || 100, ...rest };
        })
      )
      .compose(higherOrderFilterInput(async () => true))
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
