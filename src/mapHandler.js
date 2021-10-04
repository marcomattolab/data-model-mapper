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

const mapper = require('json-mapper');
const fs = require('fs');
const config = require('../config');
const utils = require('./utils/utils.js');
const validator = require('./schemaHandler.js');
const unorm = require('unorm');
const staticPattern = /static:(.*)/;
const dotPattern = /(.*)\.(.*)/;

const log = require('./utils/logger').app(module);
const report = require('./utils/logger').report;

const loadMap = (mapData) => {

    if (typeof mapData === 'object' && mapData.absolute) {
        log.info('Loading Map File');
        return new Promise(function (resolve, reject) {
            resolve(JSON.parse(fs.readFileSync(mapData.absolute, 'utf8')));
        });

    } else {
        return new Promise(function (resolve, reject) {
            resolve(mapData);
        });
    }

};

// This function takes in input the source object, uses map object to map to a destination data Model
// according to the passed data model Json Schema
const mapObjectToDataModel = (rowNumber, source, map, modelSchema, site, service, group, entityIdField) => {

    var result = {};
    // If the destKey is entityIdField and has only "static:" fields, the pair value indicates only an ID prefix
    // The resulting string will be concatenated with rowNumber
    var isIdPrefix = false;

    for (var mapDestKey in map) {

        let mapSourceKey = map[mapDestKey];    // sourceField map object or key-value pair
        let singleResult = undefined;
        let schemaDestKey = modelSchema.allOf[0].properties[mapDestKey];

        //// If the map key has a . , it means that the source key is an object
        //if (mapDestKey.test(dotPattern)){
        //    var extrFields = mapDestKey.match(dotPattern);
        //    // Check if there are other subfields for this object field
        //    if (extrFields.length > 1) {


        //  Check if destKey is present in modelSchema ?
        if (schemaDestKey || mapDestKey === entityIdField) {

            // If the value of key-value maping pair is a function definition, eval it.
            //if ( (typeof mapSourceField == "string") && mapSourceField.startsWith("function")) {
            //    map[destKey] = utils.parseFunction(mapSourceField);

            // Convert the single source field from map, to the final mapped single object or key-value pair, to be validated
            // If valid, it is added to the final result object, otherwise is discarded

            // Normalize encoding, avoiding problems with fields name not recognized due to different source encoding
            var normSourceKey = JSON.parse(unorm.nfc(JSON.stringify(mapSourceKey)));

            // Initialize with normalized Source Key, can be replaced in the specific cases below
            let parsedSourceKey = normSourceKey;

            // If the value type of mapped field is different from string, try first to extract it
            // If destination Schema field is OneOf
            if (schemaDestKey && !schemaDestKey.type && schemaDestKey.oneOf) {

                var oneOf = schemaDestKey.oneOf;

                /** If Destination Key is an object with coordinates it's a location type field or if it is "geometry" **/
                if (mapDestKey === 'location') {
                    if (normSourceKey.type && normSourceKey.coordinates && normSourceKey.type.startsWith('static:')) {

                        var parsedStaticType = normSourceKey.type.match(staticPattern)[1];
                        if (Array.isArray(oneOf) && oneOf.find(k => k.properties.type.enum.find(e => e == parsedStaticType))) {

                            parsedSourceKey['type'] = new Function("input", "return '" + parsedStaticType + "'");
                            parsedSourceKey['coordinates'] = new Function("input", "return " + "[Number(input['" + normSourceKey.coordinates[0] + "']),Number(input['" + normSourceKey.coordinates[1] + "'])]");
                        }

                    } else if (normSourceKey === 'geometry' || normSourceKey === 'location') {
                        parsedSourceKey = new Function("input", "return input['" + normSourceKey + "'];");
                    } else
                        continue;
                }

                /********************* Destination Key is an Object ****************************************/
            } else if (schemaDestKey && schemaDestKey.type === 'object' && typeof normSourceKey === 'object') {

                for (let key in normSourceKey) {

                    let schemaDestSubKey = schemaDestKey.properties[key];
                    if (schemaDestSubKey) {

                        let schemaFieldType = schemaDestSubKey.type;
                        let schemaFieldFormat = schemaDestSubKey.format;
                        let mapSourceSubField = normSourceKey[key];

                        parsedSourceKey[key] = {};
                        if (schemaFieldType === 'number' || schemaFieldType === 'integer') {
                            parsedSourceKey[key] = new Function("input", "return Number(input['" + mapSourceSubField + "']);");
                        } else if (schemaFieldType === 'boolean') {
                            parsedSourceKey[key] = new Function("input", "return (input['" + mapSourceSubField + "'].toLowerCase() == 'true' || input['" + mapSourceSubField + "'] == 1 || input['" + mapSourceSubField + "'] == '1'  ) ? true: false");
                        } else if (schemaFieldType === 'string' && schemaFieldFormat === 'date-time') {
                            parsedSourceKey[key] = new Function("input", "return new Date(input['" + mapSourceSubField + "']).toISOString();");
                        } else if (schemaFieldType === 'string' && Array.isArray(mapSourceSubField)) {
                            parsedSourceKey[key] = new Function("input", "return " + handleSourceFieldsArray(mapSourceSubField).result);
                        } else if (schemaFieldType === 'string' && typeof mapSourceSubField === 'string' && mapSourceSubField.startsWith("static:")) {
                            parsedSourceKey[key] = new Function("input", "return '" + mapSourceSubField.match(staticPattern)[1] + "'");
                        } else {
                            // normal string no action required
                            parsedSourceKey[key] = mapSourceSubField;
                        }

                        // Add type to the nested map field
                        //parsedNorm[key]['type'] = new Function("input", "return '" + schemaFieldType + "'");
                    }
                }

                /********************* Destination Field is an Array ********************************************/
            } else if (schemaDestKey && schemaDestKey.type === 'array' && Array.isArray(normSourceKey)) {

                parsedSourceKey = new Function("input", "return " + handleSourceFieldsToDestArray(normSourceKey));

                /********************* Destination Field is a Number ********************************************/
            } else if (schemaDestKey && (schemaDestKey.type === 'number' || schemaDestKey.type === 'integer')) {

                if (Array.isArray(normSourceKey))
                    parsedSourceKey = new Function("input", "return " + handleSourceFieldsArray(normSourceKey, 'number').result);

                else {
                    parsedSourceKey = handleDottedField(normSourceKey);
                    if (parsedSourceKey.startsWith('[')) {
                        let num = eval('source' + parsedSourceKey);
                        if (typeof num === 'string')
                            parsedSourceKey = new Function("input", "return Number(input['" + normSourceKey + "'])");
                        else if (typeof num === 'number')
                            parsedSourceKey = new Function("input", "return input['" + normSourceKey + "']");
                    }
                }

                /********************* Destination Field is a String ********************************************/
            } else if (schemaDestKey && (schemaDestKey.type === 'boolean')) {

                parsedSourceKey = new Function("input", "return (input['" + normSourceKey + "'].toLowerCase() == 'true' || input['" + normSourceKey + "'] == 1 || input['" + normSourceKey + "'] == '1'  ) ? true: false");

            } else if (schemaDestKey && schemaDestKey.type === 'string') {

                if (schemaDestKey.format === 'date-time') {

                    var date = eval('source' + handleDottedField(normSourceKey));
                    if (date === undefined || date === '')
                        continue;
                    parsedSourceKey = new Function("input", "return new Date(input" + handleDottedField(normSourceKey) + ").toISOString()");

                } else if (Array.isArray(normSourceKey)) {

                    parsedSourceKey = new Function("input", "return " + handleSourceFieldsArray(normSourceKey).result);

                } else if (typeof normSourceKey === 'string' && normSourceKey.startsWith("static:")) {
                    parsedSourceKey = new Function("input", "return '" + normSourceKey.match(staticPattern)[1] + "'");

                }

                /********************* Destination Key is a entityId field (according to definition in config.js) **/
            } else if (mapDestKey == entityIdField) {

                if (Array.isArray(normSourceKey) && normSourceKey.length !== 0) {
                    let resIdFields = handleSourceFieldsArray(normSourceKey);
                    parsedSourceKey = new Function("input", "return " + resIdFields.result);
                    isIdPrefix = resIdFields.isOnlyStatic;
                }
                else if (normSourceKey.startsWith("static:"))
                    parsedSourceKey = new Function("input", "return '" + normSourceKey.match(staticPattern)[1] + "'");

            }

            // Add type to map field
            //parsedNorm.type = new Function("input", "return '" + modelSchemaDestKey.type +"'");

            /********************* Perform actual mapping with parsed and normalized source key (parsedNorm) **/

            var converter = mapper.makeConverter({ [mapDestKey]: parsedSourceKey });
            try {
                singleResult = converter(source);
            } catch (error) {
                log.error(`There was an error: ${error} while processing ${parsedSourceKey} field`);
                continue;
            }

            /********************* Check if mapping result is valid ************************************************/


            if (singleResult && Object.entries(singleResult).length !== 0
                && (mapDestKey == entityIdField || checkPairWithDestModelSchema(singleResult, mapDestKey, modelSchema, rowNumber))) {

                // Additional processing of sourceValue (e.g. filtering or concatenation with other fields)
                // .....
                // Add the mapped singleResult and the destination key to result object

                result[mapDestKey] = singleResult[mapDestKey];

            } else {
                log.debug(`Skipping source field: ${JSON.stringify(mapSourceKey)} because the value ${JSON.stringify(singleResult)} is not valid for mapped key: ${mapDestKey}`);
            }

        } else {
            log.info(`The mapped key: ${mapDestKey} is not present in the selected Data Model Schema`);
        }


    }


    // Append type field, according to the Data Model Schema
    result.type = modelSchema.allOf[0].properties.type.enum[0];
    // Generate unique id for the mapped object (according to Id Pattern)
    result.id = utils.createSynchId(result.type, site, service, group, result[entityIdField], isIdPrefix, rowNumber);
    delete result[entityIdField];

    /** Once we added only valid mapped single entries, let's do a final validation against the whole final mapped object
    * Despite single validations, the following one is mandatory to be successful
    **/
    if (checkResultWithDestModelSchema(result, mapDestKey, modelSchema, rowNumber)) {
        log.debug('Mapped object, number: ' + rowNumber + ' is compliant with target Data Model');
        report.info('Mapped object, number: ' + rowNumber + ' is compliant with target Data Model');
        process.env.validCount++;
        return result;

    } else {

        report.info('--------------------------------------------------------------------------------\n' +
            'Mapped object, number:' + rowNumber + ', id: ' + result.id + ' is not compliant with target Data Model! Skipping!\n' +
            JSON.stringify(result) +
            '\n--------------------------------------------------------------------------------\n');

        log.debug('Mapped object, number: ' + rowNumber + ', id: ' + result.id + ' is not compliant the target Data Model! Skipping!');
        process.env.unvalidCount++;
        return undefined;
    }

};

/* This function takes in input the source value to be mapped with a destination object, coming from the Data Model Schema
*  and checks if constraints present in the destination Model object are met by the source value
**/
const checkPairWithDestModelSchema = (mappedObject, destKey, modelSchema, rowNumber) => {

    var result = validator.validateSourceValue(mappedObject, modelSchema, true, rowNumber);
    return result;

};

/* This function takes in input the final whole mapped object and validate it against the destination Data Model Schema
 **/
const checkResultWithDestModelSchema = (mappedObject, destKey, modelSchema, rowNumber) => {

    return validator.validateSourceValue(mappedObject, modelSchema, false, rowNumber);

};

/* Concatenates fields of the source array into a string (Source is array, dest is string)
 */
const handleSourceFieldsArray = (sourceFieldArray, sourceFieldType) => {

    var finalArray = [];
    var isOnlyStatic = true;
    var isNumber = (sourceFieldType && sourceFieldType === 'number');
    // If value of string array startwith "static:" it is a static string to be concatenated,
    // not the name of the source field.
    sourceFieldArray.forEach(function (value, index, array) {

        var staticMatch = value.match(staticPattern);
        if (staticMatch && staticMatch.length > 0) {
            // filter forbidden characters
            var filterMatch = undefined;
            if (!(filterMatch = staticMatch[1].match(/^([^\(]*)(\((.*)\)|\n|<|>|"|'|=|;|\(|\))(.*)$/)))
                finalArray[index] = "'" + staticMatch[1] + "'";
            else if (filterMatch.length === 1)
                finalArray[index] = ' ';
            else if (filterMatch.length === 5)
                finalArray[index] = "'" + filterMatch[1] + (filterMatch[3] ? filterMatch[3] : "") + filterMatch[4] + "'";
            else
                finalArray[index] = "'" + filterMatch[1] + filterMatch[4] + "'";
        } else {

            isOnlyStatic = false;
            var splittedDot = value.match(dotPattern);

            if (splittedDot) {

                splittedDot.shift();
                if (splittedDot.length > 0) {
                    finalArray[index] = finalArray[index] = (isNumber ? "Number(" : "") + "input['" + splittedDot.join("']['") + "']" + (isNumber ? ")" : "");
                } //return Number(input['" + normSourceKey + "'])

            } else {
                finalArray[index] = (isNumber ? "Number(" : "") + "input['" + value + "']" + (isNumber ? ")" : "");
            }
        }
    });

    return {
        result: finalArray.join(' + '),
        isOnlyStatic: isOnlyStatic
    };

};

/* Map fields of the source array into a stringifed Array (source and dest are both arrays)
*/
const handleSourceFieldsToDestArray = (sourceFieldArray) => {

    if (sourceFieldArray.length > 0) {
        var finalArray = [];
        var resultString = undefined;
        // If value of string array startwith "static:" it is a static string to be concatenated,
        // not the name of the source field.
        sourceFieldArray.forEach(function (value, index, array) {

            var staticMatch = value.match(staticPattern);
            if (staticMatch && staticMatch.length > 0) {

                finalArray[index] = staticMatch[1];

            } else {

                var splittedDot = value.match(dotPattern);
                if (splittedDot) {

                    splittedDot.shift();
                    if (splittedDot.length > 0)
                        finalArray[index] = "input['" + splittedDot.join("']['") + "']";

                } else {
                    finalArray[index] = "input['" + value + "']";
                }
            }
        });

        // print Array String as output
        resultString = '[';
        finalArray.forEach(function (value, index) {
            if (value.startsWith("input")) {
                resultString += value + ',';

            } else { //static
                resultString += '"' + value + '",';
            }
        });

        resultString = resultString.slice(0, resultString.length - 1) + ']';
        return resultString;
    } else return '[]';
};

/* Returns array notation from dotten notation (without input)
 */
const handleDottedField = (fieldName) => {

    var staticMatch = fieldName.match(staticPattern);
    if (staticMatch && staticMatch.length > 0) {

        return staticMatch[1];

    } else {

        var splittedDot = fieldName.match(dotPattern);

        if (splittedDot) {

            splittedDot.shift();
            if (splittedDot.length > 0)
                return "['" + splittedDot.join("']['") + "']";

        } else {
            return "['" + fieldName + "']";
        }
    }

};

module.exports = {
    loadMap: loadMap,
    mapObjectToDataModel: mapObjectToDataModel
};