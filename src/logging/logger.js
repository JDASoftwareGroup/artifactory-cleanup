

import winston from 'winston'
import moment from 'moment'

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, splat, colorize } = format;
const formatter = info => `${moment(info.timestamp).format('L h:mm:ss.SS A')} ${info.level}: ${info.message}`;

const logger = function logger() {
    const args = require('../args/args');
    const createdLogger =  createLogger({
        format:  combine(splat(), colorize(), timestamp(), printf(formatter))   ,
        transports: [new transports.Console({
            colorize: true,
            level:    process.env.LOG_LEVEL || args.getLoggingLevel() || 'info',
            silent:   args.isQuiet()
        })]
    });
    createdLogger.formatter = formatter;
    return createdLogger;
}();


module.exports = logger;
