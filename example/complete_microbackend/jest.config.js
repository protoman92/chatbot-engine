const path = require("path");

module.exports = {
  testMatch: [
    path.join("<rootDir>", "src", "**", "*.(test|spec).(js|jsx|ts|tsx)"),
  ],
  testEnvironment: "node",
  transformIgnorePatterns: ["node_modules"],
  transform: { "^.+\\.jsx?$": "ts-jest", "^.+\\.tsx?$": "ts-jest" },
  verbose: true,
};
