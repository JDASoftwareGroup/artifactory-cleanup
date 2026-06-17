

import errorEx from 'error-ex'

const MalformedQueryError = errorEx('MalformedQueryError', {
    status:    errorEx.append(' status %s'),
    url:       errorEx.append(' url %s')
});

export default MalformedQueryError;
