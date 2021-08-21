const path = require("path");

module.exports = {
  verbose: true,
  roots: ["<rootDir>"],
  moduleNameMapper: { "^lodash-es$": "lodash" },
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.tsx?$": "ts-jest",
  },
  testMatch: [path.join("<rootDir>", "src", "**", "*.(test|spec).ts")],
  testEnvironment: "node",
  collectCoverage: false,
};
