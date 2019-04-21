import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { createContentSubject } from '../../src';

describe('Content subject', () => {
  it('Should receive updates on subscription', () => {
    // Setup
    let nextCount = 0;
    let completeCount = 0;
    const subject = createContentSubject();

    // When
    const subscription = subject.subscribe({
      next: async () => (nextCount += 1),
      complete: async () => (completeCount += 1)
    });

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subscription.unsubscribe();

    // Then
    expectJs(nextCount).to.equal(3);
    expectJs(completeCount).to.equal(1);
  });

  it('Should complete all internal observers on complete', () => {
    // Setup
    let completeCount = 0;
    const subject = createContentSubject();

    // When
    subject.subscribe({
      next: async () => {},
      complete: async () => (completeCount += 1)
    });

    subject.complete();
    subject.complete();
    subject.complete();
    subject.complete();

    // Then
    expectJs(completeCount).to.equal(1);
  });
});
