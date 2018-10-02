'use strict';

import errorEx from 'error-ex'

let MalformedQueryError = errorEx('MalformedQueryError', {
    status:    errorEx.append(' status %s'),
    url:       errorEx.append(' url %s')
});

module.exports = MalformedQueryError;