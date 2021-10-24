const path = require("path");

module.exports = {
  collectCoverage: false,
  roots: ["<rootDir>"],
  moduleNameMapper: { "^lodash-es$": "lodash" },
  testMatch: [path.join("<rootDir>", "src", "**", "*.(test|spec).ts")],
  testEnvironment: "node",
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.tsx?$": "ts-jest",
  },
  transformIgnorePatterns: ["/node_modules/(?!(@haipham/javascript-helper.*))"],
  verbose: true,
};
