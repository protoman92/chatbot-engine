import { BigNumber } from 'bignumber.js';
import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import { enumerateCombinations } from '../../src/content/leaf-selector-tester';

describe('Leaf selector tester utilities', () => {
  function range(length: number) {
    return [...Array(length).keys()];
  }

  function randomBetween(incl: number, excl: number) {
    return Math.round((excl - incl) * Math.random()) + incl;
  }

  it('Enumerating combinations should work', () => {
    /// Setup
    const testData = range(4).map(() =>
      range(randomBetween(3, 6)).map(() =>
        range(randomBetween(3, 6)).map(() => randomBetween(1, 100))
      )
    );

    function combinationSum(combinations: number[][]) {
      let current = new BigNumber(1);

      combinations.forEach(combination =>
        combination.forEach(element => (current = current.plus(element)))
      );

      return current;
    }

    function combinationCount(data: number[][]) {
      let current = 1;
      data.forEach(({ length }) => (current *= length));
      return current;
    }

    function totalRawDataSum(data: number[][]) {
      let current = new BigNumber(1);

      data.forEach((datum, i) => {
        const dataCopy = data.map(datum1 => datum1);
        dataCopy.splice(i, 1);
        const combiCount = combinationCount(dataCopy);
        datum.forEach(elem => (current = current.plus(elem * combiCount)));
      });

      return current;
    }

    /// When
    testData.forEach(data => {
      const allCombinations = enumerateCombinations(data);
      expectJs(allCombinations.length).to.equal(combinationCount(data));

      expectJs(
        combinationSum(allCombinations.map(cs => cs.map(({ value }) => value)))
          .minus(totalRawDataSum(data))
          .toNumber()
      ).to.equal(0);
    });
  });
});
