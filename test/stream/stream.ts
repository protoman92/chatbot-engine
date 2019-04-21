import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { createContentSubject } from '../../src';

describe('Content subject', () => {
  it('Should receive updates on subscription', async () => {
    // Setup
    let nextCount = 0;
    let completeCount = 0;
    const subject = createContentSubject();

    // When
    const subscription = await subject.subscribe({
      next: async () => (nextCount += 1),
      complete: async () => (completeCount += 1)
    });

    await subject.next(1);
    await subject.next(2);
    await subject.next(3);
    await subscription.unsubscribe();

    // Then
    expectJs(nextCount).to.equal(3);
    expectJs(completeCount).to.equal(1);
  });

  it('Should complete all internal observers on complete', async () => {
    // Setup
    let completeCount = 0;
    const subject = createContentSubject();

    // When
    await subject.subscribe({
      next: async () => {},
      complete: async () => (completeCount += 1)
    });

    await subject.complete();
    await subject.complete();
    await subject.complete();
    await subject.complete();

    // Then
    expectJs(completeCount).to.equal(1);
  });
});
