import {
  chunkString,
  firstSubString,
  getCrossPlatformOutput,
  lastSubstring,
  mapSeries,
  omitNull,
} from "./utils";

describe("Common utilities", () => {
  it("Getting cross platform output should work", async () => {
    // Setup && When
    const fbOutput = await getCrossPlatformOutput({
      facebook: [{ content: { text: "", type: "text" } }],
    })("facebook");

    const tlOutput = await getCrossPlatformOutput({
      telegram: [{ content: { text: "", type: "text" } }],
    })("telegram");

    // Then
    expect(fbOutput).toEqual([{ content: { text: "", type: "text" } }]);
    expect(tlOutput).toEqual([{ content: { text: "", type: "text" } }]);
  });

  it("Map series should maintain order", async function () {
    // Setup
    const data = [...Array(5).keys()];

    function randomizeNumber(from: number, to: number) {
      return Math.round(Math.random() * (to - from) + from);
    }

    function resolveDatum(datum: number): Promise<number> {
      return new Promise((resolve) => {
        setTimeout(() => resolve(datum), randomizeNumber(50, 100));
      });
    }

    // When
    const mappedData = await mapSeries(data, resolveDatum);

    // Then
    expect(mappedData).toEqual(data);
  });

  it("Omit null should work", async () => {
    expect(omitNull([null, 1, 2, undefined, 3])).toEqual([1, 2, 3]);
  });

  it("Chunk string should work", async () => {
    // Setup
    // When
    // Then
    expect(
      chunkString(
        `
1
2
3
4
5
`.trim(),
        2
      )
    ).toEqual(["1\n", "2\n", "3\n", "4\n", "5"]);

    expect(chunkString("👶🏻👦🏻👧🏻", 1)).toEqual(["👶🏻", "👦🏻", "👧🏻"]);
  });

  it("First subString should work", async () => {
    // Setup
    // When
    // Then
    expect(firstSubString("👶🏻👦🏻👧🏻", 1)).toEqual({
      firstSubstring: "👶🏻",
      restSubstring: "👦🏻👧🏻",
    });
  });

  it("Last subString should work", async () => {
    // Setup
    // When
    // Then
    expect(lastSubstring("👶🏻👦🏻👧🏻", 1)).toEqual({
      lastSubstring: "👧🏻",
      restSubstring: "👶🏻👦🏻",
    });
  });
});
