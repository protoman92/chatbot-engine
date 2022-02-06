const path = require("path");

module.exports = {
  collectCoverage: false,
  moduleNameMapper: { "^lodash-es$": "lodash" },
  roots: ["<rootDir>"],
  testMatch: [path.join("<rootDir>", "**", "*.(test|spec).ts")],
  testEnvironment: "node",
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.tsx?$": "ts-jest",
  },
  transformIgnorePatterns: ["/node_modules/(?!(@haipham/javascript-helper.*))"],
  verbose: true,
};
