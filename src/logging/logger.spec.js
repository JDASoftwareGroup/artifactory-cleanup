

import mockConsole from 'jest-mock-console';
import mockArgs from "../test-fixtures/mock-args"


describe('Proxy Artifactory requests', () => {


  describe('Log messages', () => {
    mockArgs();

    test('returns the correct formatted message',  () => {
      const logger = require('../logging');
      mockConsole(['log','info','warn','error']);
      Date.now = jest.fn(() => new Date("2017-08-09T13:00:00").valueOf());
      expect(logger.formatter({'level':'info','message':'hello'})).toBe('08/09/2017 1:00:00.00 PM info: hello');
    });
  });
});
