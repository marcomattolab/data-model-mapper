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

const csv = require('csv-stream');
const request = require('request');
const fs = require('fs');
const utils = require('../utils/utils.js');
const log = require('../utils/logger').app(module);
const config = require('../../config');


// All of these arguments are optional.
var options = {
    delimiter: config.delimiter || ',', // default is ,
    endLine: config.endLine || '\n', // default is \n,
    //columns: ['columnName1', 'columnName2'], // by default read the first line and use values found as columns
    columnOffset: 0, // default is 0
    escapeChar: '', // default is an empty string
    enclosedChar: '"' // default is an empty string
};


function sourceDataToRowStream(sourceData, map, schema, rowHandler, mappedHandler, finalizeProcess) {

    // The Source Data is the File Stream
    if (sourceData && utils.isReadableStream(sourceData)) {

        try {
            fileToRowStream(sourceData, map, schema, rowHandler, mappedHandler, finalizeProcess);
        }
        catch (err) {
            log.error('There was an error while getting buffer from source data: ' + err);
        }
    }

    // The source Data is the file URL
    else if (utils.httpPattern.test(sourceData.path))
        urlToRowStream(sourceData, map, schema, rowHandler, mappedHandler, finalizeProcess);

    // The Source Data is the file path
    else if (sourceData.ext)
        fileToRowStream(fs.createReadStream(sourceData.absolute), map, schema, rowHandler, mappedHandler, finalizeProcess);
    else
        log.error("No valid Source Data was provided");
}

function urlToRowStream(url, map, schema, rowHandler, mappedHandler, finalizeProcess) {

    var csvStream = csv.createStream(options);
    var rowNumber = Number(process.env.rowNumber);
    var rowStart = Number(process.env.rowStart);
    var rowEnd = Number(process.env.rowEnd);

    request(url).pipe(csvStream)
        .on('error', function (err) {
            console.error(err);
        })
        .on('header', function (columns) {
            //  console.log('Columns: ' + columns);
        })
        .on('data', function (data) {

            rowNumber = Number(process.env.rowNumber) + 1;
            process.env.rowNumber = rowNumber;
            // outputs an object containing a set of key/value pair representing a line found in the csv file.
            if (rowNumber >= rowStart && rowNumber <= rowEnd) {

                rowHandler(rowNumber, row, map, schema, mappedHandler);
            }
        })
        .on('column', function (key, value) {
            // outputs the column name associated with the value found
            // console.log('#' + key + ' = ' + value);
        })
        .on('end', async function () {
            try {
                await finalizeProcess();
                
            } catch (error) {
                log.error("Error While finalizing the streaming process: " + error);
            }
        });
}


function fileToRowStream(inputData, map, schema, rowHandler, mappedHandler, finalizeProcess) {

    var csvStream = csv.createStream(options);
    var rowNumber = Number(process.env.rowNumber);
    var rowStart = Number(process.env.rowStart);
    var rowEnd = Number(process.env.rowEnd);

    inputData.pipe(csvStream)
        .on('error', function (err) {
            console.error(err);
        })
        .on('header', function (columns) {
            // console.log(columns);
        })
        .on('data', function (row) {

            rowNumber++;
            process.env.rowNumber = rowNumber;
            // outputs an object containing a set of key/value pair representing a line found in the csv file.
            if (rowNumber >= rowStart && rowNumber <= rowEnd) {

                rowHandler(rowNumber, row, map, schema, mappedHandler);

            }
        })
        .on('column', function (key, value) {
            // outputs the column name associated with the value found
            //console.log('#' + key + ' = ' + value);
        })
        .on('end', async function () {
            try {
                await finalizeProcess();
             
            } catch (error) {
                log.error("Error While finalizing the streaming process: " + error);
            }
        });

}


module.exports = {
    sourceDataToRowStream: sourceDataToRowStream
};