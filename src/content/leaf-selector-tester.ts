import { deepClone } from '../common/utils';
import { Context } from '../type/common';
import { LeafSelector } from '../type/leaf-selector';
import {
  EnumeratedElement,
  LeafCombinationTesterParam
} from '../type/leaf-selector-tester';
import { getCurrentLeafID, joinPaths } from './leaf-pipeline';

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

/**
 * Create a leaf selector tester to sequentially test leaf flows.
 * @template C The context used by the current chatbot.
 * @param compareEqual Function to check equality of two objects.
 * @param defaultContext The default context object.
 * @param param2 A leaf selector instance.
 */
export function createLeafSelectorTester<C extends Context>(
  compareEqual: (v1: unknown, v2: unknown) => Promise<boolean | any>,
  defaultContext: C,
  { selectLeaf }: LeafSelector<C>
) {
  type DefaultInputCombinationDependency = Readonly<{
    beforeAllCombinations?: () => Promise<void>;
    beforeEachCombination?: () => Promise<void>;
    afterEachCombination?: () => Promise<void>;
    afterAllCombinations?: () => Promise<void>;
    activeBranchPathsComponents: string[];
  }>;

  type DefaultBranchSequenceDependency = Readonly<{
    beforeEachIteration?: () => Promise<void>;
    afterEachIteration?: () => Promise<void>;
  }>;

  return {
    defaultContext,
    defaultInputCombinationDependency: (
      params: DefaultInputCombinationDependency
    ): DefaultInputCombinationDependency => params,

    testInputCombinations: async <Leaves>(
      {
        beforeAllCombinations,
        beforeEachCombination,
        afterEachCombination,
        afterAllCombinations,
        activeBranchPathsComponents
      }: DefaultInputCombinationDependency,
      leaves: LeafCombinationTesterParam<C, Leaves>[]
    ) => {
      const textInputs = leaves.map(({ possibleInputs }) => possibleInputs);
      const textCombinations = enumerateCombinations(textInputs);
      if (beforeAllCombinations) await beforeAllCombinations();

      const results = await Promise.all(
        textCombinations.map(async combinations => {
          if (beforeEachCombination) await beforeEachCombination();
          let oldContext = defaultContext;

          const result = await Promise.all(
            combinations.map(async ({ index: inputIndex, value }, i) => {
              const {
                beforeStory,
                afterStory,
                leafKey,
                checkExternals,
                expectedContext
              } = leaves[i];

              if (beforeStory) await beforeStory();
              let { newContext } = await selectLeaf(oldContext, value);
              const { activeBranch, ...restContext } = newContext;

              newContext = {
                ...deepClone(restContext),
                activeBranch: undefined
              } as C;

              if (expectedContext) {
                const incomingContext = deepClone(expectedContext(inputIndex));

                if (!(await compareEqual(incomingContext, newContext))) {
                  throw Error(
                    `Mismatched context:
                      - Exp: ${JSON.stringify(incomingContext)}\n\n
                      - Got: ${JSON.stringify(newContext)}.
                      FYI, input was ${value} for story ${leafKey}`
                  );
                }
              }

              if (checkExternals) await checkExternals(newContext);

              if (joinPaths(...activeBranchPathsComponents) !== activeBranch) {
                throw Error(
                  `Mismatched active flow:
                    - Exp: ${joinPaths(...activeBranchPathsComponents)}
                    - Got: ${activeBranch}`
                );
              }

              oldContext = newContext;
              if (afterStory) await afterStory();
              return undefined;
            })
          );

          if (afterEachCombination) await afterEachCombination();
          return result;
        })
      );

      if (afterAllCombinations) await afterAllCombinations();
      return results;
    },
    testStorySequence: async <Leaves>(
      {
        beforeEachIteration,
        afterEachIteration
      }: DefaultBranchSequenceDependency,
      sequence: Readonly<{ text: string; leafID: keyof Leaves }>[]
    ) => {
      let oldContext = defaultContext;

      return Promise.all(
        sequence.map(async ({ text, leafID }, i) => {
          if (beforeEachIteration) await beforeEachIteration();
          const { newContext } = await selectLeaf(oldContext, text);
          const currentLeafID = getCurrentLeafID(newContext.activeBranch);

          if (leafID !== currentLeafID) {
            throw Error(`${i}: Expected ${currentLeafID}, got ${leafID}`);
          }

          oldContext = newContext;
          if (afterEachIteration) await afterEachIteration();
          return undefined;
        })
      );
    }
  };
}
