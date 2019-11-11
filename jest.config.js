module.exports = {
  "testEnvironment": "node",
  "coverageDirectory": "./coverage/",
    "collectCoverageFrom": [
        "src/**/*.js",
        "!src/**/*.{.spec.js}",
        "!src/test-fixtures/*.js",
        "!src/**/index.js"
    ],
    "testPathIgnorePatterns": [
        "<rootDir>/(commonjs|coverage|node_modules|tools|umd)/"
    ],
  "collectCoverage": true,
  "coverageReporters": [
    "html",
    "lcovonly",
    "text",
    "text-summary"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    }
  },
  "testResultsProcessor": "jest-sonar-reporter",
  "setupFilesAfterEnv": ["jest-mock-console/dist/setupTestFramework.js"]
};
