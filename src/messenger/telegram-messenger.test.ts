import expectJs from "expect.js";
import { describe, it } from "mocha";
import { extractInputCommand } from "./telegram-messenger";

describe("Utilities", () => {
  it("Should extract input command and text correctly", async () => {
    const username = "haipham";

    // Setup && When && Then 1
    const [command1, text1] = extractInputCommand(
      username,
      `/start    @haipham    run123  `
    );

    expectJs(command1).to.eql("start");
    expectJs(text1).to.eql("run123");

    // Setup && When && Then 2
    const [command2, text2] = extractInputCommand(username, "run123");
    expectJs(command2).not.to.be.ok();
    expectJs(text2).to.eql("run123");

    // Setup && When && Then 3
    const [command3, text3] = extractInputCommand(
      username,
      `/start @haiphamrun123`
    );

    expectJs(command3).to.eql("start");
    expectJs(text3).to.eql("run123");

    // Setup && When && Then 4
    const [command4, text4] = extractInputCommand(
      username,
      `/start@haiphamrun123`
    );

    expectJs(command4).to.eql("start");
    expectJs(text4).to.eql("run123");

    // Setup && When && Then 5
    const [command5, text5] = extractInputCommand(
      username,
      `/start@haipham run123
456
789
      `
    );

    expectJs(command5).to.eql("start");

    expectJs(text5).to.eql(`run123
456
789`);

    // Setup && When && Then 6
    const [command6, text6] = extractInputCommand(username, "/start run123");
    expectJs(command6).to.eql("start");
    expectJs(text6).to.eql("run123");
  });
});
