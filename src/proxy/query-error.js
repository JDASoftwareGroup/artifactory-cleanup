

import errorEx from 'error-ex'

const QueryError = errorEx('QueryError', {
    url:       errorEx.append(' url %s')
});

module.exports = QueryError;
