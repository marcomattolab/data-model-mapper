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

const config = require('../../config');
const log = require('../utils/logger').app(module);
const fs = require('fs');
const process = require('../utils/process');
const { Client } = require('presto-stream-client');


function pCsvClient(contentJson, sourceDataType, mapPath, dataModelPath, filename) {
    var csv = '';
    try {
        log.debug("## Doing query with Presto (CSV)...");
        var querySql=contentJson.querySql;
        var outFileFormat=contentJson.outFileFormat;
        log.debug("## querySql: " + querySql);
        log.debug("## outFileFormat: " + outFileFormat);

        //Presto Client - See https://github.com/serakfalcon/presto-stream-client
        const client = new Client({
            user: config.presto_user,
            host: config.presto_host,
            port: config.presto_port,
            catalog: contentJson.datalog,
            schema: contentJson.schema
        });

        client.execute({
            query: ''+querySql,
            //catalog: 'tpch',
            //schema:  'sf1',
            objectMode: true
        }).then((statement)=>{
            statement.on('columns', (columns)=> {
                columns.forEach(function(item, index, columns) {
                    //csv += item.name + (index === columns.length - 1 ? '' : ';');
                    csv += '"'+ item.name + '"' + (index === columns.length - 1 ? '' : ';');
                });
                csv += "\n";
                //log.debug("## (ALL) => "+ csv);
            });
            statement.on('data', (row) => {
                const keys = Object.keys(row);
                for (let i = 0; i < keys.length; i++) {
                  const key = keys[i];
                  //log.debug("# key: " + key + "  value: " +row[key]);
                  csv += row[key] + (i+1==keys.length ? "" : ";");
                }
                csv += "\n";
                //log.debug("## (ROW) => "+ csv);
            });
            statement.on('end',()=> {
                log.debug('## Done CSV: ' + csv);
                sourceData = createFile(csv, filename, outFileFormat);
                process.processSource(sourceData, sourceDataType, mapPath, dataModelPath);
                log.debug('## processSource, sourceData: ' + sourceData);

            });
        },(error)=> {
            console.error(error);
        });


    } catch (error) {
        return error;
    }
}

/** Create file <filename>.<outFileFormat> with passed content **/
function createFile(content, filename, outFileFormat) {
    let sourceData = filename + "." + outFileFormat;
    fs.writeFileSync(sourceData, content);
    return sourceData;
}

module.exports = {
    pCsvClient: pCsvClient
};