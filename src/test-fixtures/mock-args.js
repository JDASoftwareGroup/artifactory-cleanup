import yargs from 'yargs'

function mockArgs() {

  const argv = yargs(['-u', 'jane.doe@acme.org', '-a', 'http://acme.org', '-t', 'gift-token'
                       , '-n', 'years', '-o', '1'])
    .argv;
  return argv;
}

export default mockArgs
