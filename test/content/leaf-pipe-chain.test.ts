import expectJs from 'expect.js';
import { anything, instance, spy, verify } from 'ts-mockito';
import {
  catchError,
  createDefaultErrorLeaf,
  createLeafWithObserver,
  createPipeChain,
  Leaf,
  mapOutput,
  thenInvoke
} from '../../src';
import { DEFAULT_COORDINATES } from '../../src/common/utils';
import {
  bridgeEmission,
  createSubscription,
  STREAM_INVALID_NEXT_RESULT
} from '../../src/stream/stream';

const targetID = 'target-id';
const targetPlatform = 'facebook';

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

    const transformed = await createPipeChain()
      .pipe<{}>(
        mapOutput(async response => ({
          ...response,
          additionalContext: { a: 1 }
        }))
      )
      .transform(baseLeaf);

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

    const baseLeaf = spy(
      await createLeafWithObserver(async () => ({
        next: async () => ({})
      }))
    );

    const transformed = await createPipeChain()
      .pipe(thenInvoke(...sequentialLeaves.map(leaf => instance(leaf))))
      .transform(instance(baseLeaf));

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
    verify(baseLeaf.next(anything())).once();
    verify(baseLeaf.complete!()).once();
    verify(baseLeaf.subscribe(anything())).once();

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

    const trasformed = await createPipeChain()
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
      .transform(baseLeaf);

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
