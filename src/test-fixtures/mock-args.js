import yargs from 'yargs'

function mockArgs() {

  return yargs(['-u', 'jane.doe@acme.org', '-a', 'http://acme.org', '-t', 'gift-token'
                       , '-n', 'years', '-o', '1'])
    .argv;
}

export default mockArgs
