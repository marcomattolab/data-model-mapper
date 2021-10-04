/*******************************************************************************
 * Data Model Mapper
 *  Copyright (C) 2019 Engineering Ingegneria Informatica S.p.A.
 *  
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * at your option) any later version.
 *  
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *  
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/

const winston = require('winston');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
// { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }


const myFormat = printf(msg => {
    return `[${msg.timestamp} [${msg.label}] ${msg.level}: ${msg.message}`;
});

const getLabel = (callingModule) => {
    var parts = callingModule.filename.split(path.sep);
    return path.join(parts[parts.length - 2], parts.pop());
};

const logFormat = (callingModule) => {
    if (callingModule)
        return combine(
            label({
                label: getLabel(callingModule)
            }),
            timestamp(),
            myFormat
        );
    else
        return combine(
            label({
                label: __filename.replace(/^.*[\\\/]/, '')
            }),
            timestamp(),
            myFormat
        );
};

const transport = () => {
    return new winston.transports.DailyRotateFile({
        dirname: './logs',
        level: process.env.LOG || 'info',
        filename: 'out.log',
        datePattern: 'YYYY-MM-DD',
        maxsize: '50mb', //5MB,
        zippedArchive: true
    });
};

const transportErr = () => {
    return new winston.transports.DailyRotateFile({
        dirname: './logs',
        level: "error",
        filename: 'error.log',
        datePattern: 'YYYY-MM-DD',
        maxsize: '50mb', //5MB,
        zippedArchive: true
    });
};

const reportTransport = new winston.transports.DailyRotateFile({
    dirname: './reports/validation',
    filename: 'out.log',
    datePattern: 'YYYY-MM-DD',
    maxsize: '500mb', //5MB,
    zippedArchive: true
});

const reportTransportErr = new winston.transports.DailyRotateFile({
    dirname: './reports/validation',
    level: "error",
    filename: 'error.log',
    datePattern: 'YYYY-MM-DD',
    maxsize: '500mb', //5MB,
    zippedArchive: true
});

const orionReportTransport = new winston.transports.DailyRotateFile({
    dirname: './reports/orion',
    filename: 'out.log',
    datePattern: 'YYYY-MM-DD',
    maxsize: '500mb', //5MB,
    zippedArchive: true
});

const orionReportTransportErr = new winston.transports.DailyRotateFile({
    dirname: './reports/orion',
    level: "error",
    filename: 'error.log',
    datePattern: 'YYYY-MM-DD',
    maxsize: '500mb', //5MB,
    zippedArchive: true
});

//
// Return the logger for generic app log, with specific label for passed module name
//

const createAppLogger = (module) => {
    let logger =
        winston.createLogger({
            transports: [
                transport(),
                transportErr()
            ],
            format: logFormat(module)
        });

    // Add console transport in case we are not in production
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new winston.transports.Console({
            format: logFormat(module),
            level: process.env.LOG || 'info'
        }));
    }
    return logger;

};




//
// Configure the logger for report
//
winston.loggers.add('report', {
    transports: [
        reportTransport,
        reportTransportErr
    ],
    format: logFormat()
});

//
// Configure the logger for Orion report
//
winston.loggers.add('orionReport', {
    transports: [
        orionReportTransport,
        orionReportTransportErr
    ],
    format: logFormat()
});


module.exports = {
    app: createAppLogger,
    report: winston.loggers.get('report'),
    orionReport: winston.loggers.get('orionReport')
};

