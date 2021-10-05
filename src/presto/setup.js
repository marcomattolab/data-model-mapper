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

const commandLine = require('../utils/confUtils');
const process = require('../utils/process');
const config = require('../../config');
const log = require('../utils/logger').app(module);
const utils = require('../utils/utils');

const fs = require('fs');
const pJsonClient = require('./pJsonClient');
const pCsvClient = require('./pCsvClient');


module.exports = (sourceDataIn, mapPathIn, dataModelIn) => {
    log.info("Initializing Mapper in Command Line Extended Mode (Presto)");

    if (commandLine.init()) {
        // file path or directly string/binary content 
        //var sourceData = sourceDataIn || commandLine.getParam('sourceDataPath');

        // query path 
        var queryPath = sourceDataIn || commandLine.getParam('queryPath');

        var mapPath = mapPathIn || commandLine.getParam('mapPath');
        var dataModelPath = utils.getDataModelPath(dataModelIn) || commandLine.getParam('targetDataModel');

        try {
            log.info("## Extended Mode Invoking Presto ...");

            if (queryPath) {
                if (typeof queryPath === 'string') {
                    let queryPathObj = utils.parseFilePath(queryPath);
                    var extension = queryPathObj.ext;
                    if (!extension) {
                        log.error('The provided url/file query path does not have file extension');
                        return Promise.reject('The provided query url / file path does not have file extension');
                    }
                    if (extension != ".json") {
                        log.error('The provided url/file query path does not have "json" extension');
                        return Promise.reject('The provided query url / file path does not have "json" extension');
                    }
                }
            }

            //Retrieve query, fileFormat
            //log.info("## queryPath " + queryPath);
            var data=fs.readFileSync(queryPath, 'utf8');
            var contentJson=JSON.parse(data);
            //log.info("## data " + data);
            
            if ('json' == contentJson.outFileFormat) {
                filename= queryPath.slice(0, -5);
                filename+= getFileSuffix();
                pJsonClient.pJsonClient(contentJson, "", mapPath, dataModelPath, filename);            

            } else if ('csv' == contentJson.outFileFormat) {
                filename= queryPath.slice(0, -5);
                filename+= getFileSuffix();
                pCsvClient.pCsvClient(contentJson, "", mapPath, dataModelPath, filename);

            } else if ('geojson' == contentJson.outFileFormat) {
                filename = queryPath.slice(0, -8);
                filename+= getFileSuffix();
                //TODO DEVELOP
                //pGeojsonClient.pGeojsonClient(contentJson, "", mapPath, dataModelPath, filename);
            }

        } catch (error) {
            return error;
        }

    } else {
        log.error("There was an error while initializing Mapper configuration");
    }
};

function getFileSuffix() {
    var dt = new Date();
    return dt.getFullYear() + "_" + (dt.getMonth() + 1) + "_" + dt.getDate() + "_" + dt.getTime();
}

