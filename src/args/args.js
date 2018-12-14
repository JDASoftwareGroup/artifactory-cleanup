'use strict';
import argv from 'yargs'
import ArgsError from './args-error.js'

function getBaseYargs() {
    const argv = require('yargs');
    let baseArgs;
    try {
        baseArgs = argv
            .usage('Usage: artifactory-cleanup [options]')
            .option('a', {
                alias:    'artifactoryApiUrl',
                demand:   true,
                describe: 'Artifactory server API URL'
            })
            .option('u', {
                alias:    'user',
                demand:   true,
                describe: 'Artifactory user with permission to API'
            })
            .option('q', {
                alias:    'quiet',
                boolean:  'boolean',
                describe: 'Quiet down output'
            })
            .option('t', {
                alias:    'token',
                demand:   true,
                describe: 'Artifactory user generated token'
            })
            .option('f', {
                alias:    'filter',
                default:  '*-local',
                describe: 'Repository filter'
            })
            .option('p', {
                alias:    'path',
                describe: 'Path prefix filter'
            })
            .option('l', {
                alias:    'logging',
                describe: 'logging level',
                choices:  getLoggingLevels()
            })
            .option('d', {
                alias:     'date',
                conflicts: ['n', 'o', 'k'],
                describe:  'Threshold date (ISO-8610 format)'
            })
            .option('k', {
                alias:    'keep',
                describe: 'Threshold to keep only nth newest artifact parent folders',
                type:     'number'
            })
            .option('o', {
                alias:     'duration',
                implies:   'n',
                conflicts: ['d'],
                describe:  'Duration of time for threshold. To be combined with `unit` parameter'
            })
            .option('n', {
                alias:     'unit',
                choices:   getTimeUnits(),
                implies:   'o',
                conflicts: ['d'],
                describe:  'Unit of time for threshold. To be combined with `duration` parameter'
            })
            .option('r', {
                alias:    'dryrun',
                describe: 'Dry run of the utility. Not files will be deleted'
            })
            .check(checkDependencies, false)
            .wrap(argv.terminalWidth())
            .exitProcess(false).argv;
    } catch (error) {
        process.exit(1);
    }
    return baseArgs || {};
}

function checkDependencies(parsedArgv = {}) {
    if ((parsedArgv.n && parsedArgv.o) || parsedArgv.d) {
        return true
    } else {
        throw new Error("Set threshold can be either duration and unit or date");
    }
}

function getTimeUnits() {
    return ['years', 'y', 'quarters', 'Q', 'months', 'M', 'weeks', 'w', 'days', 'd', 'hours', 'h', 'minutes', 'm',
        'seconds', 's', 'milliseconds', 'ms']
}


function getLoggingLevels() {
    return ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
}

function getConnectionUrl() {
    return getBaseYargs().a;
}

function getUserName() {
    return getBaseYargs().u;
}

function getToken() {
    return getBaseYargs().t;
}

function getLoggingLevel() {
    return getBaseYargs().l;
}

function getConnectionDefaults() {
    return {
        baseURL: module.exports.getConnectionUrl(),
        auth:    {
            username: module.exports.getUserName(),
            password: module.exports.getToken()
        },
        headers: { 'content-type': 'text/plain' }
    }
}
function getThresholdUnit() {
    return getBaseYargs().n;
}

function getThresholdDuration() {
    return getBaseYargs().o;
}

function getThresholdDate() {
    return getBaseYargs().d;
}

function getThresholdKeep() {
    return getBaseYargs().k;
}

function isDryRun() {
    return getBaseYargs().r;
}

function isQuiet() {
    return getBaseYargs().q;
}


function getPrefixFilter() {
    return getBaseYargs().p;
}


function getRepositoryFilter() {
    return getBaseYargs().f;
}

module.exports = {
    getConnectionDefaults,
    isQuiet,
    isDryRun,
    getLoggingLevel,
    getThresholdDuration,
    getThresholdUnit,
    getThresholdDate,
    getThresholdKeep,
    checkDependencies,
    getPrefixFilter,
    getRepositoryFilter,
    getConnectionUrl,
    getUserName,
    getToken
};
