import expectJs from "expect.js";
import { describe, it } from "mocha";
import { mapSeries } from "./utils";

describe("Common utilities", () => {
  it("Map series should maintain order", async function() {
    // Setup
    this.timeout(5000);
    const data = [...Array(5).keys()];

    function randomizeNumber(from: number, to: number) {
      return Math.round(Math.random() * (to - from) + from);
    }

    function resolveDatum(datum: number): Promise<number> {
      return new Promise(resolve => {
        setTimeout(() => resolve(datum), randomizeNumber(50, 100));
      });
    }

    // When
    const mappedData = await mapSeries(data, resolveDatum);

    // Then
    expectJs(mappedData).to.eql(data);
  });
});
