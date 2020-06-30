import expectJs from "expect.js";
import { describe, it } from "mocha";
import {
  getCrossPlatformOutput,
  mapSeries,
  omitNull,
  requireNotNull,
  chunkString,
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
    expectJs(fbOutput).to.eql([{ content: { text: "", type: "text" } }]);
    expectJs(tlOutput).to.eql([{ content: { text: "", type: "text" } }]);
  });

  it("Map series should maintain order", async function () {
    // Setup
    this.timeout(5000);
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
    expectJs(mappedData).to.eql(data);
  });

  it("Omit null should work", async () => {
    expectJs(omitNull([null, 1, 2, undefined, 3])).to.eql([1, 2, 3]);
  });

  it("Require not null should work", async () => {
    expectJs(requireNotNull(1)).to.eql(1);
    expectJs(() => requireNotNull(null)).to.throwError();
  });

  it("Chunk string should work", async () => {
    // Setup
    // When
    // Then
    expectJs(
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
    ).to.eql(["1\n", "2\n", "3\n", "4\n", "5"]);

    expectJs(chunkString("👶🏻👦🏻👧🏻", 1)).to.eql(["👶🏻", "👦🏻", "👧🏻"]);
  });
});
