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

//MMA - Presto Client
const fs = require('fs');
const util = require('util');
const pipeline = util.promisify(require('stream').pipeline);
const { Client } = require('presto-stream-client');

//MMA - Presto Client - See https://github.com/serakfalcon/presto-stream-client
const client = new Client({
    user: 'presto',
    host: "localhost",
    port: "8080",
    catalog: 'tpch',
    schema:  'sf1'
});


module.exports = (sourceDataIn, mapPathIn, dataModelIn) => {
    log.info("Initializing Mapper in Command Line Mode");

    if (commandLine.init()) {

        // file path or directly string/binary content 
        var sourceData = sourceDataIn || commandLine.getParam('sourceDataPath');
        var mapPath = mapPathIn || commandLine.getParam('mapPath');
        var dataModelPath = utils.getDataModelPath(dataModelIn) || commandLine.getParam('targetDataModel');

        //MMA [PRESTO]
        log.info("## Doing query with Presto...");
        client.execute({
            query: 'SELECT l.returnflag, sum(l.quantity) AS sum_qty FROM  tpch.sf1.lineitem AS l WHERE 1=1 GROUP BY l.returnflag',
            //query: 'SELECT l.returnflag, l.linestatus, sum(l.quantity) AS sum_qty, sum(l.extendedprice) AS sum_base_price, sum(l.extendedprice * (1 - l.discount)) AS sum_disc_price, sum(l.extendedprice * (1 - l.discount) * (1 + l.tax)) AS sum_charge, avg(l.quantity) AS avg_qty, avg(l.extendedprice) AS avg_price, avg(l.discount) AS avg_disc, count(*) AS count_order FROM tpch.sf1.lineitem AS l WHERE l.shipdate <= DATE \'1998-12-01\' - INTERVAL \'90\' DAY GROUP BY l.returnflag, l.linestatus ORDER BY l.returnflag, l.linestatus',
            //query: 'SHOW SCHEMAS',
            catalog: 'tpch',
            schema:  'sf1',
            objectMode: false
        }).then((statement)=>{
            statement.on('columns',(columns)=>{  // [{name:"cnt",type:"bigint"}, {name:"usergroup",type:"varchar"}]
                console.log("## (ALL) => "+JSON.stringify(columns));
            });
            statement.on('data',(row)=>{
                console.log("## (ROW) => "+row); // {cnt:1234,usergroup:"admin"}
            });
            statement.on('end',()=>{
                console.log('## done');
            });
        },(error)=>{
            console.error(error);
        });
        log.info("## Done, we're awaiting for Presto query results!!!");
        //

        try {
            process.processSource(sourceData, "", mapPath, dataModelPath);
        } catch (error) {
            return error;
        }

    } else {
        log.error("There was an error while initializing Mapper configuration");
    }
};

