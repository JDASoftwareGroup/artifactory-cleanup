'use strict';
import yargs from 'yargs'

function mockArgs() {
  const argv = yargs(['-u', 'jane.doe@acme.org', '-a', 'http://acme.org', '-t', 'gift-token'
                     ,'-n', 'years', '-o', '1'])
    // your code goes here
    .argv
/*  jest.mock('../args');
  const args = require('../args');
  args.getLoggingLevel.mockReturnValue('info');
  args.getUserName.mockReturnValue('jane.doe@acme.org');
  args.getConnectionUrl.mockReturnValue('http://acme.org');
  args.getToken.mockReturnValue('gift-token');

  args.getPrefixFilter = () => undefined;
  return args;*/
}

export default mockArgs
