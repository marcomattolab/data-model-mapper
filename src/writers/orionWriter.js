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

const rp = require('promise-request-retry');

const config = require('../../config').orionWriter;
const report = require('../utils/logger').orionReport;
const log = require('../utils/logger').app(module);
const proxyConf = config.enableProxy ? config.proxy : undefined;

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const buildRequestHeaders = () => {

    var headerObject = {
        'Fiware-Service': process.env.fiwareService,
        'Fiware-ServicePath': process.env.fiwareServicePath
    };

    if (process.env.orionAuthHeaderName && process.env.orionAuthToken)
        headerObject[process.env.orionAuthHeaderName] = process.env.orionAuthToken;

    return headerObject;

};


const writeObject = async (objNumber, obj, modelSchema) => {

    if (obj) {
        log.debug('Sending to Orion CB object number: ' + objNumber + ' , id: ' + obj.id);

        var orionedObj = toOrionObject(obj, modelSchema);

        var options = {
            method: 'POST',
            headers: buildRequestHeaders(),
            uri: process.env.orionUrl + '/v2/entities',
            body: orionedObj,
            json: true,
            simple: false,
            resolveWithFullResponse: true,
            retry: config.maxRetry,
            proxy: proxyConf,
            rejectUnauthorized: false
        };

        try {
            // Wait for Create Response
            var createResponse = await rp(options);

            // Entity is new
            if (createResponse.statusCode == 201) {

                report.info('Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' correctly CREATED in the Context Broker');
                log.debug('Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' correctly CREATED in the Context Broker');
                return Promise.resolve(process.env.orionWrittenCount++);

            } else if (createResponse.statusCode == 422 && createResponse.body && createResponse.body.description == 'Already Exists') {

                // Update existing entity
                if (!config.skipExisting) {

                    // If entity already exists, try to update it
                    var existingId = orionedObj.id;
                    delete orionedObj.id;
                    delete orionedObj.type;

                    // Replace request URI and Method with the onse for updating entities attribute
                    options.uri = process.env.orionUrl + '/v2/entities/' + existingId + '/attrs';
                    options.method = process.env.updateMode == 'REPLACE' ? 'PUT' : 'POST';

                    try {
                        // Wait for update response
                        var updateResponse = await rp(options);

                        if (updateResponse.statusCode == 204) {

                            report.info('Entity Number: ' + objNumber + ' with Id: ' + existingId + ' already exists! Correctly UPDATED in the Context Broker');
                            log.debug('Entity Number: ' + objNumber + ' with Id: ' + existingId + ' already exists! Correctly UPDATED in the Context Broker');
                            return Promise.resolve(process.env.orionWrittenCount++);

                        } else {
                            return Promise.reject('Update Error').catch((error) =>  log.error('There was an error while writing Mapped Object: ' + error));
                        }

                    } catch (error) {

                        report.info('----------------------------------------------------------\n' +
                            'Entity Number: ' + objNumber + ' with Id: ' + existingId + ' NOT UPDATED in the Context Broker');
                        log.debug('Entity Number: ' + objNumber + ' with Id: ' + existingId + ' NOT UPDATED in the Context Broker');

                        report.info('error: ' + error); // Print the error if one occurred
                        log.debug('error: ' + error);

                        if (error)
                            report.info('statusCode: ' + error.statusCode); // Print the response status code if a response was received
                        report.info('body: ' + JSON.stringify(error));
                        report.info('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
                        log.debug('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
                        process.env.orionUnWrittenCount++;
                        return Promise.reject(error).catch((error) => log.error('There was an error while writing Mapped Object: ' + error));

                    }

                } else {

                    // Skip existing entity
                    report.info('Entity Number: ' + objNumber + ' with Id: ' + orionedObj.id + ' SKIPPED');
                    log.debug('Entity Number: ' + objNumber + ' with Id: ' + orionedObj.id + ' SKIPPED');
                    return Promise.resolve(process.env.orionSkippedCount++);

                }

            } else {
                process.env.orionUnWrittenCount++;
                return Promise.reject('Error returned from Context Broker: ' + JSON.stringify(createResponse) + '\n').catch((error) => log.error('There was an error while writing Mapped Object: ' + error));
            }

        } catch (error) {

            report.info('----------------------------------------------------------\n' +
                'Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' NOT CREATED in the Context Broker');
            log.debug('Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' NOT CREATED in the Context Broker');

            report.info('error: ' + error); // Print the error if one occurred
            log.debug('error: ' + error);

            if (error)
                report.info('statusCode: ' + error.statusCode);
            report.info('body: ' + JSON.stringify(error));
            report.info('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
            log.debug('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
            process.env.orionUnWrittenCount++;
            return Promise.reject(error);

        }

    } else
        return new Promise((resolve, reject) => {
            log.debug("Mapped Object is undefined!, nothing to send to Orion Context Broker")
            resolve();
        });
}



/* OLD - TO BE REMOVED **/
//function writeObject(objNumber, obj, modelSchema, retryNum = 0) {

//    if (obj) {
//        log.debug('Sending to Orion object number: ' + objNumber + ' , id: ' + obj.id);

//        var orionedObj = undefined;
//        if (retryNum == 0)
//            orionedObj = toOrionObject(obj, modelSchema);
//        else
//            orionedObj = obj;

//        sleep(5);

//        // Proxy config
//        if (config.proxy) {
//            request = request.defaults({ 'proxy': config.proxy });
//        }


//        request.post({
//            headers: { 'content-type': 'application/json' },
//            url: process.env.orionUrl + '/v2/entities',
//            body: orionedObj,
//            json: true
//        }, function (error, response, body) {

//            // Entity is new
//            if (response && response.statusCode == 201) {
//                report.info('Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' correctly CREATED in the Context Broker');
//                log.debug('Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' correctly CREATED in the Context Broker');
//                process.env.orionWrittenCount++;
//                checkAndPrintFinalReport();
//            } else if (response && response.statusCode == 422 && response.body && response.body.description == 'Already Exists') {

//                // UPDATE EXISTING ENTITIES
//                if (!config.skipExisting) {

//                    // If entity already exists, try to update it
//                    var existingId = orionedObj.id;
//                    delete orionedObj.id;
//                    delete orionedObj.type;
//                    request.post({
//                        headers: { 'content-type': 'application/json' },
//                        url: process.env.orionUrl + '/v2/entities/' + existingId + '/attrs',
//                        body: orionedObj,
//                        json: true
//                    }, function (error, response, body) {
//                        if (response && response.statusCode == 204) {

//                            report.info('Entity Number: ' + objNumber + ' with Id: ' + existingId + ' already exists! Correctly UPDATED in the Context Broker');
//                            log.debug('Entity Number: ' + objNumber + ' with Id: ' + existingId + ' already exists! Correctly UPDATED in the Context Broker');
//                            process.env.orionWrittenCount++;
//                            checkAndPrintFinalReport();
//                        } else {

//                            report.info('----------------------------------------------------------\n' +
//                                'Entity Number: ' + objNumber + ' with Id: ' + existingId + ' NOT UPDATED in the Context Broker');
//                            log.debug('Entity Number: ' + objNumber + ' with Id: ' + existingId + ' NOT UPDATED in the Context Broker');

//                            report.info('error: ' + error); // Print the error if one occurred
//                            log.debug('error: ' + error);

//                            if (response)
//                                report.info('statusCode: ' + response.statusCode); // Print the response status code if a response was received
//                            report.info('body: ' + JSON.stringify(body));

//                            if (error && (retryNum < config.maxRetry)) {
//                                retryNum++;
//                                report.info('Retrying num:' + retryNum + ' to send Object: ' + objNumber + ' with Id: ' + existingId);
//                                log.debug('Retrying num:' + retryNum + ' to send Object: ' + objNumber + ' with Id: ' + existingId);

//                                sleep(2);
//                                writeObject(objNumber, obj, modelSchema, retryNum);

//                            } else {

//                                report.info('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
//                                log.debug('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
//                                process.env.orionUnWrittenCount++;
//                                checkAndPrintFinalReport();

//                            }

//                        }

//                    });

//                } else {

//                    // SKIP EXISTING ENTITIES
//                    report.info('Entity Number: ' + objNumber + ' with Id: ' + orionedObj.id + ' SKIPPED');
//                    log.debug('Entity Number: ' + objNumber + ' with Id: ' + orionedObj.id + ' SKIPPED');
//                    process.env.orionSkippedCount++;
//                    checkAndPrintFinalReport();

//                }

//            } else {
//                report.info('----------------------------------------------------------\n' +
//                    'Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' NOT CREATED in the Context Broker');
//                log.debug('Entity Number: ' + objNumber + ' with Id: ' + obj.id + ' NOT CREATED in the Context Broker');

//                report.info('error: ' + error); // Print the error if one occurred
//                if (response)
//                    report.info('statusCode: ' + response.statusCode);
//                report.info('body: ' + JSON.stringify(body));

//                //if (error && (typeof error == 'string') && (error == 'Error: read ECONNRESET' || error == 'Error: socket hang up' || error.startsWith('Error: connect ETIMEDOUT')) && (retryNum < config.maxRetry)) {

//                if (error && (retryNum < config.maxRetry)) {

//                    retryNum++;
//                    report.info('Retrying num: ' + retryNum + ' to send Object: ' + objNumber + ' with Id: ' + orionedObj.id);
//                    log.debug('Retrying num: ' + retryNum + ' to send Object: ' + objNumber + ' with Id: ' + orionedObj.id);

//                    sleep(2);
//                    writeObject(objNumber, obj, modelSchema, retryNum);

//                } else {

//                    report.info('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
//                    log.debug('Mapped and unwritten object:\n' + JSON.stringify(orionedObj) + '\n ------------------------------\n');
//                    log.debug("PRE ORION OBJECT:\n" + JSON.stringify(obj) + '\n ------------------------------\n');
//                    process.env.orionUnWrittenCount++;
//                    checkAndPrintFinalReport();
//                }
//            }
//        });
//    } else {
//        log.debug("Mapped Object is undefined!, nothing to send to Orion Context Broker");
//    }

//}


function toOrionObject(obj, schema) {

    // log.debug("Transforming Mapped object to an Orion Entity (explicit types in attributes)");

    for (key in obj) {
        if (key != 'id' && key != 'type') {

            var modelField = schema.allOf[0].properties[key];
            var modelFieldType = modelField.type;
            var modelFieldFormat = modelField.format;
            var objField = obj[key];

            if (key == 'location') {

                var newValue = {};
                newValue = {
                    type: "geo:json",
                    value: objField
                };
                obj['location'] = newValue;

            } else if (modelFieldType === 'object') {

                //var nestedValue = {};
                //for (fieldKey in objField) {

                //    var modelSubField = modelField.properties[fieldKey];
                //    var modelSubFieldType = modelSubField.type;
                //    var modelSubFieldFormat = modelSubField.format;

                //    if (modelSubFieldFormat)
                //        nestedValue[fieldKey] = {
                //            value: objField[fieldkey],
                //            type: modelSubFieldType,
                //            format: modelSubFieldFormat
                //        }
                //    else
                //        nestedValue[fieldKey] = {
                //            value: objField[fieldKey],
                //            type: modelSubFieldType
                //        }

                //    delete objField[fieldKey];
                //}

                var nestedObject = objField;
                delete objField;
                obj[key] = {
                    type: modelFieldType,
                    value: nestedObject
                }

            } else {

                if (modelFieldFormat) {
                    if (modelFieldFormat === 'date-time')
                        obj[key] = {
                            type: 'DateTime',
                            value: objField
                        };
                    else
                        obj[key] = {
                            type: modelFieldType,
                            value: objField
                           // format: modelFieldFormat
                        };
                }
                else
                    obj[key] = {
                        type: modelFieldType,
                        value: objField
                    }
            }
        }
    }

    return obj;
}


function printOrionFinalReport(logger) {

    logger.info('\t\n--------ORION REPORT----------\n' +
        '\t Object written to Orion Context Broker: ' + process.env.orionWrittenCount + '/' + process.env.validCount + '\n' +
        '\t Object NOT written to Orion Context Broker: ' + process.env.orionUnWrittenCount + '/' + process.env.validCount + '\n' +
        '\t Object SKIPPED: ' + process.env.orionSkippedCount + '/' + process.env.validCount + '\n' +
        '\t-----------------------------------------');

}

/// Use Events?
function checkAndPrintFinalReport() {
    if ((parseInt(process.env.orionWrittenCount) + parseInt(process.env.orionSkippedCount) + parseInt(process.env.orionUnWrittenCount)) == parseInt(process.env.validCount)) {
        printOrionFinalReport(log);
        printOrionFinalReport(report);
    }
}

module.exports = {
    writeObject: writeObject,
    checkAndPrintFinalReport: checkAndPrintFinalReport
}