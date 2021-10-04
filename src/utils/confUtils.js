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

const nconf = require('nconf');
const config = require('../../config');
const log = require('./logger').app(module);
const path = require('path');
const pathPattern = /^.+(\/|\\)[^\/|\\]+$/g;
const utils = require('./utils');
nconf.use('memory');

process.argv.forEach(function (val, index, array) {
    nconf.argv({
        'mapPath': {
            alias: 'm',
            describe: 'File path of the mapping Json',
            type: 'string',
            demand: false
        },
        'sourceDataPath': {
            alias: 's',
            describe: 'File path of source data, following file types are supported:\n' +
                'CSV: The first row defines columns, each next one represents one data row\n' +
                'GeoJson: It must be a Feature Collection, where each Feature represents a data row' +
                'Json: a generic regular json array',
            type: 'string',
            demand: false
        },
        'targetDataModel': {
            alias: 'd',
            describe: 'The name of target Data Model in which source data will be mapped',
            type: 'string',
            demand: false
        },
        'site': {
            alias: 'si',
            describe: 'Site part of SynchroniCity Entity Id pattern. It can represent a RZ, City or area that includes several different IoT deployments, services or apps (e.g., Porto, Milano, Santander, Aarhus, Andorra, etc)',
            type: 'string',
            demand: false
        },
        'service': {
            alias: 'se',
            describe: 'Service part of SynchroniCity Entity Id pattern. It can represent a represents a smart city service/application domain for example parking, garbage, environmental etc',
            type: 'string',
            demand: false
        },
        'group': {
            alias: 'gr',
            describe: 'Group part of SynchroniCity Entity Id pattern. IT can be used for grouping assets under the same service and/or provider (so it can be used to identify different IoT providers). It is responsibility of OS sites to maintain proper group keys',
            type: 'string',
            demand: false
        },
        'rowStart': {
            alias: 'rs',
            describe: 'Row of the input file from which the mapper will start to map objects (Allowed values are integers >= 0)',
            type: 'string',
            demand: false
        },
        'rowEnd': {
            alias: 're',
            describe: ' Last Row of the input file that will be mapped (Allowed values are integers >0 or Infinity (it indicates until the end of file)',
            type: 'string',
            demand: false
        },
        'orionUrl': {
            alias: 'u',
            describe: 'URL of the context broker where mapped entities will be written',
            type: 'string',
            demand: false
        },
        'updateMode': {
            alias: 'um',
            describe: 'Update Mode of existing entities (APPEND or REPLACE)',
            type: 'string',
            demand: false
        },
        'skipExisting': {
            alias: 'sk',
            describe: 'Skip mapped entities (same ID) already existing in the CB, otherwise update them according to updateMode parameter',
            type: 'string',
            demand: false
        },
        'orionAuthHeaderName': {
            alias: 'oa',
            describe: 'Authorization header name to be put in the Orion Request (with form "orionAuthHeaderName : orionAuthToken)"',
            type: 'string'
        },
        'orionAuthToken': {
            alias: 'ot',
            describe: 'Authorization Token to be put in the Orion Request (with form "orionAuthHeaderName : orionAuthToken)"',
            type: 'string'
        },
        'fiwareService': {
            alias: 'fs',
            describe: 'Fiware-Service header to be put in the Orion request',
            type: 'string'
        },
        'fiwareServicePath': {
            alias: 'fsp',
            describe: 'Fiware-ServicePath header to be put in the Orion request"',
            type: 'string'
        },
        'outFilePath': {
            alias: 'f',
            describe: 'Output file path to printout mapped entities',
            type: 'string',
            demand: false
        },
        //'mo': {
        //    alias: 'mapOutput',
        //    describe: 'Output file to printout validation results. If not specified, it will be printed over the standard output',
        //    type: 'string',
        //    demand: false
        //},
        //'oo': {
        //    alias: 'orionOutput',
        //    describe: 'Output file to printout Orion writing results. If not specified, it will be printed over the standard output',
        //    type: 'string',
        //    demand: false
        //},
        'h': {
            alias: 'help',
            describe: 'Print the help message',
            demand: false
        }
    }).add('file', { type: 'literal', store: config });
});

const help = () => {
    if (nconf.get('h')) {
        nconf.stores.argv.showHelp();
        process.exit(0);
    }
};


/* Check if mandatory configuration parameters are set either via CLI args or config file 
 * 
 **/
const checkAndInitConf = () => {

    /************ MAPPING CONFIGURATION PARAMETERS ************/
    var mapPath = nconf.get('mapPath');
    if (!mapPath) {
        log.error('You need to specify the mapping file path');
        return false;
    }
    if (mapPath && !mapPath.match(pathPattern)) {
        log.error('Incorrect mapping file path');
        return false;
    }

    var sourcePath = nconf.get('sourceDataPath');
    if (!sourcePath) {
        log.error('You need to specify the source file path');
        return false;
    }
    //if (sourcePath && !sourcePath.match(pathPattern)) {
    if (sourcePath && utils.isValidPath(sourcePath)) {
        try {
            sourcePath = path.normalize(sourcePath);
        } catch (error) {
            log.error("There was an error while normalizing Source Path: " + error);
            return false;
        }
    } else {
        log.error('Incorrect source file path');
        return false;
    }

    var dataModel = nconf.get('targetDataModel');
    if (!utils.checkInputDataModel(config.modelSchemaFolder, dataModel)) {
        log.error('Incorrect target Data Model name');
        return false;
    } else
        nconf.set('targetDataModel', path.join(config.modelSchemaFolder, dataModel + '.json'));


    //if (!nconf.get('site')) {
    //    log.error('You need to specify the site part of ID Pattern');
    //    return false;
    //}


    //if (!nconf.get('service')) {
    //    log.error('You need to specify the service part of ID Pattern');
    //    return false;
    //}


    //if (!nconf.get('group')) {
    //    log.error('You need to specify the group part of ID Pattern');
    //    return false;
    //}

    /*********************** ORION WRITER CONFIGURATION PARAMETERS *********/
    nconf.set('orionUrl', nconf.get('orionUrl') || config.orionWriter.orionUrl);
    if (!nconf.get('orionUrl')) {
        log.error('You need to specify the remote URL of Orion Context Broker');
        return false;
    }

    nconf.set('skipExisting', nconf.get('skipExisting') || config.orionWriter.skipExisting);
    if (nconf.get('skipExisting') !== true && nconf.get('skipExisting') !== false) {
        log.error('You need to specify the Skip Existing parameter of Orion Context Broker, allowed values: true, false');
        return false;
    }

    nconf.set('updateMode', nconf.get('updateMode') || config.orionWriter.updateMode);
    if (!nconf.get('updateMode') || (nconf.get('updateMode') !== 'APPEND' && nconf.get('updateMode') !== 'REPLACE')) {
        log.error('You need to specify the update Mode of Orion Context Broker, allowed values: APPEND, REPLACE');
        return false;
    }
    //} else if (nconf.get('skipExisting') !== true) {
    //    log.error('You need also to set true the Skip Existing parameter');
    //    return false;
    //}

    nconf.set('fiwareService', nconf.get('fiwareService') || config.orionWriter.fiwareService);
    //if (!nconf.get('fiwareService')) {
    //    log.error('You need to specify the Fiware-Service header of Orion Context Broker');
    //    return false;
    //}

    nconf.set('fiwareServicePath', nconf.get('fiwareServicePath') || config.orionWriter.fiwareServicePath);
    //if (!nconf.get('fiwareServicePath')) {
    //    log.error('You need to specify the Fiware-ServicePath header of Orion Context Broker');
    //    return false;
    //}

    nconf.set('orionAuthHeaderName', nconf.get('orionAuthHeaderName') || config.orionWriter.orionAuthHeaderName);
    //if (!nconf.get('orionAuthHeaderName')) {
    //    log.error('You need to specify the Authorization Header Name of Orion Context Broker');
    //    return false;
    //}

    nconf.set('orionAuthToken', nconf.get('orionAuthToken') || config.orionWriter.orionAuthToken);
    if (nconf.get('orionAuthHeaderName') && !nconf.get('orionAuthToken')) {
        log.error('You need to specify the Authorization Token of Orion Context Broker');
        return false;
    }
    if (!nconf.get('orionAuthHeaderName') && nconf.get('orionAuthToken')) {
        log.error('You need also to set the Authorization Header Name parameter');
        return false;
    }

    /*********************** FILE WRITER CONFIGURATION PARAMETERS *********/
    if (!nconf.get('outFilePath') && !config.fileWriter.filePath) {
        log.error('You need to specify the output File Path');
        return false;
    } else {
        nconf.set('outFilePath', nconf.get('outFilePath') || config.fileWriter.filePath);
    }


    /******* Set initialized confs as Global variables ***************/

    global.process.env.orionUrl = nconf.get('orionUrl');
    global.process.env.updateMode = nconf.get('updateMode');
    global.process.env.fiwareService = nconf.get('fiwareService');
    global.process.env.fiwareServicePath = nconf.get('fiwareServicePath');
    global.process.env.orionAuthHeaderName = nconf.get('orionAuthHeaderName');
    global.process.env.orionAuthToken = nconf.get('orionAuthToken');
    global.process.env.outFilePath = nconf.get('outFilePath');
    global.process.env.rowStart = nconf.get('rowStart');
    global.process.env.rowEnd = nconf.get('rowEnd');
    global.process.env.idSite = nconf.get('site');
    global.process.env.idService = nconf.get('service');
    global.process.env.idGroup = nconf.get('group');


    /** Global variables for Source Data, Map and Target Data Model are set in the specific setup.js **/

    return true;
};

const init = () => {
    help();
    return checkAndInitConf();
};

const getParam = (par) => {
    return nconf.get(par);
};



module.exports = {
    help: help,
    init: init,
    getParam: getParam
};