'use strict';

import winston from 'winston'
import moment from 'moment'

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, splat, colorize } = format;

const logger = function() {
    let args = require('../args/args');
    return createLogger({
        format:     combine(splat(), colorize(), timestamp(), printf(info => {
            return `${moment(info.timestamp).format('L h:mm:ss.SS A')} ${info.level}: ${info.message}`;
        })),
        transports: [new transports.Console({
            colorize: true,
            level:    process.env.LOG_LEVEL || args.getLoggingLevel() || 'info',
            silent:   args.isQuiet()
        })]
    });
}();


module.exports = logger;