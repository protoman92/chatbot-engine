import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { mapSeries } from '../../src/common/utils';
import {
  createContentSubject,
  mergeObservables
} from '../../src/stream/stream';

describe('Content stream and subject', () => {
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
    let nextCount = 0;
    let completeCount = 0;
    const subject = createContentSubject();

    // When
    await subject.subscribe({
      next: async () => (nextCount += 1),
      complete: async () => (completeCount += 1)
    });

    await subject.complete();
    await subject.complete();
    await subject.complete();
    await subject.complete();
    await subject.next(1);

    // Then
    expectJs(completeCount).to.equal(1);
    expectJs(nextCount).not.to.be.ok();
  });

  it('Should merge all emissions when using merging observables', async () => {
    // Setup
    const subjectCount = 1000;

    const subjects = [...Array(subjectCount).keys()].map(() => {
      return createContentSubject<number>();
    });

    const receivedValues: number[] = [];
    let completedCount = 0;

    // When
    const subscription = await mergeObservables(...subjects).subscribe({
      next: async content => receivedValues.push(content),
      complete: async () => (completedCount += 1)
    });

    await mapSeries(subjects, (subject, i) => subject.next(i));
    await subscription.unsubscribe();
    await mapSeries(subjects, (subject, i) => subject.next(i));

    // Then
    expectJs(receivedValues).to.eql([...Array(subjectCount).keys()]);
    expectJs(completedCount).to.equal(subjectCount);
  });
});
