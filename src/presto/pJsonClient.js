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


function pJsonClient(contentJson, sourceDataType, mapPath, dataModelPath, filename) {
    var json = '';
    try {
        log.debug("## Doing query with Presto (JSON)...");
        var querySql=contentJson.querySql;
        var outFileFormat=contentJson.outFileFormat;
        log.debug("## querySql: " + querySql);
        log.debug("## outFileFormat: " + outFileFormat);

        //Presto Client - See https://github.com/serakfalcon/presto-stream-client
        const client = new Client({
            user: config.presto_user,
            host: config.presto_host,
            port: config.presto_port
        });

        client.execute({
            query: ''+querySql,
            //query: 'SELECT l.returnflag as address, sum(l.quantity) AS sum_qty FROM  tpch.sf1.lineitem AS l WHERE 1=1 GROUP BY l.returnflag',
            //query: 'SELECT l.returnflag, l.linestatus, sum(l.quantity) AS sum_qty, sum(l.extendedprice) AS sum_base_price, sum(l.extendedprice * (1 - l.discount)) AS sum_disc_price, sum(l.extendedprice * (1 - l.discount) * (1 + l.tax)) AS sum_charge, avg(l.quantity) AS avg_qty, avg(l.extendedprice) AS avg_price, avg(l.discount) AS avg_disc, count(*) AS count_order FROM tpch.sf1.lineitem AS l WHERE l.shipdate <= DATE \'1998-12-01\' - INTERVAL \'90\' DAY GROUP BY l.returnflag, l.linestatus ORDER BY l.returnflag, l.linestatus',
            //query: 'SHOW SCHEMAS',
            objectMode: true
        }).then((statement)=>{
            statement.on('columns', (columns)=> {  // [{name:"cnt",type:"bigint"}, {name:"usergroup",type:"varchar"}]
                //log.debug("## (ALL) => "+JSON.stringify(columns));
            });
            statement.on('data', (row)=> {
                //log.debug("# (ROW) => " + JSON.stringify(row)); // {cnt:1234,usergroup:"admin"}
                json += JSON.stringify(row) + "," + "\n";
            });
            statement.on('end',()=> {
                const jsonValid = json != '' ? '[' + json.slice(0, -2) + ']' : json;
                log.debug('## Done JSON: ' + jsonValid);
                sourceData = createFile(jsonValid, filename, outFileFormat);
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
    pJsonClient: pJsonClient
};