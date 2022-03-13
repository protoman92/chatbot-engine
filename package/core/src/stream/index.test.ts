import { mapSeries } from "../common/utils";
import { createContentSubject, mergeObservables, NextResult } from ".";

describe("Content stream and subject", () => {
  it("Should receive updates on subscription", async () => {
    // Setup
    let nextCount = 0;
    let completedCount = 0;
    const subject = createContentSubject();

    // When
    const subscription = await subject.subscribe({
      next: async () => {
        nextCount += 1;
        return NextResult.BREAK;
      },
      complete: async () => {
        completedCount += 1;
      },
    });

    await subject.next(1);
    await subject.next(2);
    await subject.next(3);
    await subscription.unsubscribe();

    // Then
    expect(nextCount).toEqual(3);
    expect(completedCount).toEqual(1);
  });

  it("Should complete all internal observers on complete", async () => {
    // Setup
    let nextCount = 0;
    let completedCount = 0;
    const subject = createContentSubject();

    // When
    await subject.subscribe({
      next: async () => {
        nextCount += 1;
        return NextResult.BREAK;
      },
      complete: async () => {
        completedCount += 1;
      },
    });

    await subject.complete();
    await subject.complete();
    await subject.complete();
    await subject.complete();
    await subject.next(1);

    // Then
    expect(completedCount).toEqual(1);
    expect(nextCount).toBeFalsy();
  });

  it("Should merge all emissions when using merging observables", async () => {
    // Setup
    const subjectCount = 1000;

    const subjects = [...Array(subjectCount).keys()].map(() => {
      return createContentSubject<number>();
    });

    const receivedValues: number[] = [];
    let completedCount = 0;

    // When
    const subscription = await mergeObservables(...subjects).subscribe({
      next: async (content) => {
        receivedValues.push(content);
        return NextResult.BREAK;
      },
      complete: async () => {
        completedCount += 1;
      },
    });

    await mapSeries(subjects, (subject, i) => subject.next(i));
    await subscription.unsubscribe();
    await mapSeries(subjects, (subject, i) => subject.next(i));

    // Then
    expect(receivedValues).toEqual([...Array(subjectCount).keys()]);
    expect(completedCount).toEqual(subjectCount);
  });
});
