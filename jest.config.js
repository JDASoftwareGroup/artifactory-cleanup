module.exports = {
  "testEnvironment": "node",
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
  }
};