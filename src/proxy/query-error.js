'use strict';

import errorEx from 'error-ex'

let QueryError = errorEx('QueryError', {
    url:       errorEx.append(' url %s')
});

module.exports = QueryError;