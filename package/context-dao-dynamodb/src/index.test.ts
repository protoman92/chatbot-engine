import { _getContextUpdateArgs } from ".";

describe("DynamoDB context DAO", () => {
  it("Getting context update arguments should work correctly", () => {
    // Setup
    // When
    expect(
      _getContextUpdateArgs({
        a: 1,
        b: [1, 2, 3],
        c: { a: 1, b: 2, c: 3 },
        d: [{ a: 1 }, { b: 2 }, { c: 3 }],
        e: [{ a: [{ b: { c: 1 } }] }],
      })
    ).toMatchSnapshot();
  });
});
