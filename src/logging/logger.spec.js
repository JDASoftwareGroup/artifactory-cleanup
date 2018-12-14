

import mockConsole from 'jest-mock-console';
import mockArgs from "../test-fixtures/mock-args"


describe('Proxy Artifactory requests', () => {


  describe('Log messages', () => {
    mockArgs();

    test('returns the current format',  () => {
      const logger = require('../logging');
      mockConsole(['log','info','warn','error']);
      Date.now = jest.fn(() => 1482363367071);
      expect(logger.formatter({'level':'info','message':'hello'})).toBe('12/21/2016 6:36:07.07 PM info: hello');
    });
  });
});
