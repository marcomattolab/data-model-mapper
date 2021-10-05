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

const log = require('../utils/logger').app(module);
const fs = require('fs');
const process = require('../utils/process');
const util = require('util');
const pipeline = util.promisify(require('stream').pipeline);
const { Client } = require('presto-stream-client');

//MMA - Presto Client - See https://github.com/serakfalcon/presto-stream-client
const client = new Client({
    user: 'presto',
    host: "localhost",
    port: "8080",
    catalog: 'tpch',
    schema: 'sf1'
});
var json = '';

function prestoJsonClient(query, catalog, schema, sourceData, sourceDataType, mapPath, dataModelPath) {
    try {
        log.info("## Doing query with Presto...");
        client.execute({
            query: 'SELECT l.returnflag as address, sum(l.quantity) AS sum_qty FROM  tpch.sf1.lineitem AS l WHERE 1=1 GROUP BY l.returnflag',
            //query: 'SELECT l.returnflag, l.linestatus, sum(l.quantity) AS sum_qty, sum(l.extendedprice) AS sum_base_price, sum(l.extendedprice * (1 - l.discount)) AS sum_disc_price, sum(l.extendedprice * (1 - l.discount) * (1 + l.tax)) AS sum_charge, avg(l.quantity) AS avg_qty, avg(l.extendedprice) AS avg_price, avg(l.discount) AS avg_disc, count(*) AS count_order FROM tpch.sf1.lineitem AS l WHERE l.shipdate <= DATE \'1998-12-01\' - INTERVAL \'90\' DAY GROUP BY l.returnflag, l.linestatus ORDER BY l.returnflag, l.linestatus',
            //query: 'SHOW SCHEMAS',
            //catalog: 'tpch',
            //schema:  'sf1',
            objectMode: true
        }).then((statement)=>{
            statement.on('columns', (columns)=>{  // [{name:"cnt",type:"bigint"}, {name:"usergroup",type:"varchar"}]
                console.log("## (ALL) => "+JSON.stringify(columns));
            });
            statement.on('data', (row)=>{
                console.log("# (ROW) => " + JSON.stringify(row)); // {cnt:1234,usergroup:"admin"}
                json += JSON.stringify(row) + ",";
            });
            statement.on('end',()=>{
                const jsonValid = json != '' ? '[' + json.slice(0, -1) + ']' : json;
                //const obj = JSON.parse(jsonValid);
                //console.log("# test obj[0].returnflag => "+obj[0].returnflag);

                console.log('## Done json: ' + jsonValid);
                //sourceData = jsonValid; //TODO
                process.processSource(sourceData, sourceDataType, mapPath, dataModelPath);
                console.log('## processSource .... sourceData=> ' + sourceData);

            });
        },(error)=>{
            console.error(error);
        });
        log.info("## Done, we're awaiting for Presto query results!!!");

    } catch (error) {
        return error;
    }

}


module.exports = {
    prestoJsonClient: prestoJsonClient
};