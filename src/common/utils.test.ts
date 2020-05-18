import expectJs from "expect.js";
import { describe, it } from "mocha";
import { getCrossPlatformOutput, mapSeries, requireNotNull } from "./utils";

describe("Common utilities", () => {
  it("Getting cross platform output should work", async () => {
    // Setup && When
    const fbOutput = await getCrossPlatformOutput({
      facebook: [{ content: { text: "test", type: "text" } }],
    })("facebook");

    const tlOutput = await getCrossPlatformOutput({
      telegram: [{ content: { text: "test", type: "text" } }],
    })("telegram");

    // Then
    expectJs(fbOutput).to.eql({ text: "test", type: "text" });
    expectJs(tlOutput).to.eql({ text: "test", type: "text" });
  });

  it("Map series should maintain order", async function() {
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

  it("Require not null should work", async () => {
    expectJs(requireNotNull(1)).to.eql(1);
    expectJs(requireNotNull(null)).to.throwError();
  });
});
