import request from "superagent";

describe("complete_microbackend application", () => {
  function formatURL(path: string) {
    return `http://localhost:3000${path}`;
  }

  it("Healthcheck", async () => {
    // Setup
    // When
    const response = await request.get(formatURL("/"));

    // Then
    expect(response.status).toEqual(200);
  });
});
