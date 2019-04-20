import { EnumeratedElement } from '../type/leaf-selector-tester';

/**
 * Enumerate all combinations of values, for e.g., we have:
 * [1, 2] - [3, 4, 5]
 * Then all combinations are:
 * [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]
 * @template T The type of value.
 * @param arrays An Array of Arrays of values.
 * @param callback The callback used to run through every combination.
 */
export function enumerateCombinationsWithCallback<T>(
  arrays: T[][],
  callback: (...elements: EnumeratedElement<T>[]) => void
) {
  function enumerate<T>(
    arrays: T[][],
    currentArrayIndex: number,
    currentElements: EnumeratedElement<T>[],
    callback: (...elements: EnumeratedElement<T>[]) => void
  ) {
    if (currentElements.length === arrays.length) {
      callback(...currentElements);
      return;
    }

    (arrays[currentArrayIndex] || []).forEach((element, i) => {
      enumerate(
        arrays,
        currentArrayIndex + 1,
        [...currentElements, { index: i, value: element }],
        callback
      );
    });
  }

  enumerate(arrays, 0, [], callback);
}

/**
 * Enumerate all combinations of values, but this time return an Array of all
 * combinations.
 * @template T The type of value.
 * @param arrays An Array of Arrays of values.
 * @return An Array of all combinations.
 */
export function enumerateCombinations<T>(arrays: T[][]) {
  const nested: EnumeratedElement<T>[][] = [];
  enumerateCombinationsWithCallback(arrays, (...e) => nested.push(e));
  return nested;
}
