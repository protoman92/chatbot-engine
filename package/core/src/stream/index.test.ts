import { mapSeries } from "../common/utils";
import { createContentSubject, mergeObservables, NextResult } from ".";

describe("Content stream and subject", () => {
  it("Should receive updates on subscription", async () => {
    // Setup
    let nextCount = 0;
    const subject = createContentSubject();

    // When
    const subscription = await subject.subscribe({
      next: async () => {
        nextCount += 1;
        return NextResult.BREAK;
      },
    });

    await subject.next(1);
    await subject.next(2);
    await subject.next(3);
    await subscription.unsubscribe();

    // Then
    expect(nextCount).toEqual(3);
  });

  it("Should merge all emissions when using merging observables", async () => {
    // Setup
    const subjectCount = 1000;

    const subjects = [...Array(subjectCount).keys()].map(() => {
      return createContentSubject<number>();
    });

    const receivedValues: number[] = [];

    // When
    const subscription = await mergeObservables(...subjects).subscribe({
      next: async (content) => {
        receivedValues.push(content);
        return NextResult.BREAK;
      },
    });

    await mapSeries(subjects, (subject, i) => subject.next(i));
    await subscription.unsubscribe();
    await mapSeries(subjects, (subject, i) => subject.next(i));

    // Then
    expect(receivedValues).toEqual([...Array(subjectCount).keys()]);
  });
});
