import expectJs from 'expect.js';
import {
  createDefaultErrorLeaf,
  createLeafWithObserver,
  createPipeChain,
  higherOrderCatchError,
  higherOrderMapOutput,
  higherOrderThenInvokeAll,
  Leaf
} from '../../src';
import { DEFAULT_COORDINATES } from '../../src/common/utils';
import { bridgeEmission, createSubscription } from '../../src/stream/stream';

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
        higherOrderMapOutput(async response => ({
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
    let nextCount = 0;
    let completeCount = 0;
    let subscribeCount = 0;

    const baseLeaf: Leaf<{}> = {
      next: async () => {
        nextCount += 1;
        return {};
      },
      complete: async () => (completeCount += 1),
      subscribe: async () => {
        subscribeCount += 1;
        return createSubscription(async () => ({}));
      }
    };

    const transformed = await createPipeChain()
      .pipe(
        higherOrderThenInvokeAll(async () => {
          return [...Array(sequentialLeafCount).keys()].map(i => ({
            next: async () => {
              if (i === invalidIndex) return undefined;
              nextCount += 1;
              return {};
            },
            complete: async () => (completeCount += 1)
          }));
        })
      )
      .transform(baseLeaf);

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
    expectJs(nextCount).to.eql(invalidIndex + 1);
    expectJs(completeCount).to.eql(sequentialLeafCount + 1);
    expectJs(subscribeCount).to.eql(1);
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
          if (!!previousResult) throw new Error('some-error');
          return undefined;
        }
      }))
      .pipe(higherOrderCatchError(await createDefaultErrorLeaf()))
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
