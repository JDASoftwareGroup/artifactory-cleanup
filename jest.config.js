module.exports = {
  "testEnvironment": "node",
  "coverageDirectory": "./coverage/",
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
  "testResultsProcessor": "jest-sonar-reporter"
};