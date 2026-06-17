

const errorEx = require('error-ex');

const MalformedQueryError = errorEx('MalformedQueryError', {
    status:    errorEx.append(' status %s'),
    url:       errorEx.append(' url %s')
});

module.exports = MalformedQueryError;
