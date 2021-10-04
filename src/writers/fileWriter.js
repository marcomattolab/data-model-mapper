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

var fs = require('fs');
const log = require('../utils/logger').app(module);
const utils = require('../utils/utils');
const config = require('../../config').fileWriter;

var outFileStream = undefined;
var isFirstObject = true;



const writeObject = async (objNumber, obj, addBRLine) => {

    /** Initialize File Stream and its first content ***/
    if (utils.isFileWriterActive && !outFileStream) {

        outFileStream = fs.createWriteStream(process.env.outFilePath || utils.parseFilePath(config.filePath).absolute);
        outFileStream.write("[");

    }

    if (obj && process.env.outFilePath && outFileStream) {

        return new Promise((resolve, reject) => {

            log.debug('Writing to file, object number: ' + objNumber + ' , id: ' + obj.id);
            try {

                outFileStream.on('error', (error) => reject("There was an error while writing object to File Stream: " + error));
                //outFileStream.on('data', () => resolve("'Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' correctly written to file"));

                // Write the object
                if (!isFirstObject)
                    outFileStream.write(",");

                outFileStream.write(JSON.stringify(obj));
                isFirstObject = false;
                process.env.fileWrittenCount++;

                // Add a blank return line if enabled
                if (addBRLine)
                    outFileStream.write("\n");

                log.debug("'Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' correctly written to file");
                return resolve();

            } catch (err) {
                process.env.fileUnWrittenCount++;
                log.debug('Error while writing mapped object to file');
                log.debug('----------------------------------------------------------\n' +
                    'Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' NOT written to file');
                return reject(err);
            }
        });
    } else {

        return new Promise((resolve, reject) => {
            console.log('');
            log.debug("Mapped Object is undefined or the FileWriter was not correctly configured");
            return resolve();
        });
    }
};

const finalizeFile = async () => {

    return new Promise((resolve, reject) => {

        outFileStream.write("]");
        outFileStream.on('end', () => resolve("File stream correctly closed"));
        outFileStream.on('error', () => reject("File stream failed to close"));
        outFileStream.end();
        outFileStream = undefined;
        return resolve();
    }).then(value => log.debug(value)).catch(value => log.error(value));
};

const printFileFinalReport = (logger) => {

    logger.info('\t\n--------FILE WRITER REPORT----------\n' +
        '\t Object written to File: ' + process.env.fileWrittenCount + '/' + process.env.validCount + '\n' +
        '\t Object NOT written to File: ' + process.env.fileUnWrittenCount + '/' + process.env.validCount + '\n' +
        '\t-----------------------------------------');

};

/// Use Events?
function checkAndPrintFinalReport() {
    if (parseInt(process.env.fileWrittenCount) + parseInt(process.env.fileUnWrittenCount) == parseInt(process.env.validCount)) {
        printFileFinalReport(log);
    }
}

module.exports = {
    writeObject: writeObject,
    finalize: finalizeFile,
    checkAndPrintFinalReport: checkAndPrintFinalReport
}