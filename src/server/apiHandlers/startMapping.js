const streamToString = require('stream-to-string');
const utils = require('../../utils/utils');
const process = require('../../utils/process');
const log = require('../../utils/logger').app(module);

/*
 * Override default configurations (loaded in setup) if there were in the request
 */
const setOptionalConfs = (rowStart, rowEnd, site, service, group, orionUrl, updateMode, fiwareService, fiwareServicePath, outFilePath) => {

    /* Save first Default configuration, to be restored after current request */
    global.process.env.old_rowStart = global.process.env.rowStart;
    global.process.env.old_rowEnd = global.process.env.rowEnd;
    global.process.env.old_orionUrl = global.process.env.orionUrl;
    global.process.env.old_updateMode = global.process.env.updateMode;
    global.process.env.old_fiwareService = global.process.env.fiwareService;
    global.process.env.old_fiwareServicePath = global.process.env.fiwareServicePath;
    global.process.env.old_outFilePath = global.process.env.outFilePath;
    global.process.env.old_idSite = global.process.env.idSite;
    global.process.env.old_idService = global.process.env.idService;
    global.process.env.old_idGroup = global.process.env.idGroup;

    /* Override (if any) current configuration with the ones coming from the request
     * otherwise keep the default ones.
     */

    global.process.env.rowStart = rowStart || global.process.env.rowStart;
    global.process.env.rowEnd = rowEnd || global.process.env.rowEnd;
    global.process.env.orionUrl = orionUrl || global.process.env.orionUrl;
    global.process.env.updateMode = updateMode || global.process.env.updateMode;
    global.process.env.fiwareService = fiwareService || global.process.env.fiwareService;
    global.process.env.fiwareServicePath = fiwareServicePath || global.process.env.fiwareServicePath;
    global.process.env.outFilePath = outFilePath || global.process.env.outFilePath;
    global.process.env.idSite = site || global.process.env.idSite;
    global.process.env.idService = service || global.process.env.idService;
    global.process.env.idGroup = group || global.process.env.idGroup;
};



module.exports = async (req, res) => {

    var sourceData = undefined;
    var sourceDataExt = undefined;
    var map = undefined;
    var targetDataModel = undefined;
    var rowStart = undefined;
    var rowEnd = undefined;
    var site = undefined;
    var service = undefined;
    var group = undefined;
    var orionUrl = undefined;
    var updateMode = undefined;
    var outFilePath = undefined;

    req.pipe(req.busboy); // Pipe it through busboy

    /* Reset rowNumber (to be modified with per Mapping variables) DONE IN PROCESS reinitializeProcessStatus function*/
    //global.process.env.rowNumber = 0;
    //global.process.env.validCount = 0;
    //global.process.env.unvalidCount = 0;

    /**************************** Extract Headers ***************************/
    var fiwareService = req.headers['fiware-service'];
    var fiwareServicePath = req.headers['fiware-servicepath'];

    /*************************************************************************/

    req.busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {

        log.debug(`Upload of '${fieldname}':'${filename} started`);

        // Save the incoming Map Data stream to a String
        if (fieldname === 'mapFile') {
            map = streamToString(file);
        }

        if (fieldname === 'sourceData') {

            sourceData = file;

            // Set optional conf present in the request and already processed
            setOptionalConfs(rowStart, rowEnd, site, service, group, orionUrl, updateMode, fiwareService, fiwareServicePath, outFilePath);

            // Extract original file extension
            let pathObj;
            if (filename)
                pathObj = utils.parseFilePath(filename);
            if (pathObj && pathObj.ext)
                sourceDataExt = pathObj.ext;

            // If extension was not present neither as previously parsed field nor as file, return 400
            else if (!sourceDataExt) {

                let error = {
                    error: "SourceDataExtensionNotProvided",
                    errorMessage: "File extension was not provided in the request"
                };

                log.debug(error.error + " " + error.errorMessage);
                return res.status(400).send(error);
            }

            // If Map was not previously filled neither as field nor file, return 400
            if (!map) {

                let error = {
                    error: "MapFileNotProvided",
                    errorMessage: "The Map (as file, url/path, or directly as string), was not provided"
                };

                log.debug(error.error + " " + error.errorMessage);
                return res.status(400).send(error);
            }

            // Try to parse Map Data directly as string, if fails, assumes it is a file path
            try {

                map = await Promise.resolve(map);
                try {
                    map = JSON.parse(map);

                } catch (error) {
                    map = utils.parseFilePath(map);
                }

            } catch (error) {
                let response = {
                    error: "MapDataNotValid - " + error,
                    errorMessage: "The provided Map data is neither a file, url/path, or directly a string"
                };

                log.debug(response.error + " " + response.errorMessage);
                return res.status(400).send(response);
            }

            // If any Target Data Model was specified, try to extract from dedicate field in the Map
            if (!targetDataModel && map['targetDataModel']) {

                targetDataModel = map['targetDataModel'];

            } else if (!targetDataModel) {

                let error = {
                    error: "DataModelNotProvided",
                    errorMessage: "The Data Model name was empty"
                };

                log.debug(error.error + " " + error.errorMessage);
                return res.status(400).send(error);

            }

            /* Check if provided TargetDataModel is valid, otherwise return 400 */
            if ((targetDataModel = utils.getDataModelPath(targetDataModel)) === undefined) {
                let error = {
                    error: "DataModelNotValid",
                    errorMessage: "Incorrect target Data Model name"
                };

                log.debug(error.error + " " + error.errorMessage);
                return res.status(400).send(error);

            }

            //delete map['targetDataModel']; // use targetDataModel as reserved field ???

            try {
                await process.processSource(sourceData, sourceDataExt, map, targetDataModel);

                let startResponse = {
                    message: "The mapping process has been successfully started, please see the logs/report files (soon there will be a dedicated API for retrieving them)"
                };

                log.debug(startResponse);
                return res.status(200).send(startResponse);

            } catch (error) {

                let errorResponse = {
                    message: "The mapping process failed to start, please see the logs/report files (soon there will be a dedicated API for retrieving them)",
                    reason: error
                };

                log.debug(errorResponse);
                return res.status(400).send(errorResponse);

            }
        }
    });

    req.busboy.on('field', (key, value, keyTruncated, valueTruncated) => {
        log.debug(`Processing of '${key}' started`);

        switch (key) {
            case 'sourceData':
                sourceData = value;
                break;
            case 'mapFile':
                map = value;
                break;
            case 'sourceDataExtension':
                sourceDataExt = value;
                break;
            case 'targetDataModel':
                targetDataModel = value;
                break;
            case 'rowStart':
                rowStart = value;
                break;
            case 'rowEnd':
                rowEnd = value;
                break;
            case 'orionUrl':
                orionUrl = value;
                break;
            case 'updateMode':
                updateMode = value;
                break;
            case 'outFilePath':
                outFilePath = value;
                break;
            case 'site':
                site = value;
                break;
            case 'service':
                service = value;
                break;
            case 'group':
                group = value;
                break;
            default:
                break;
        }
    });

    req.busboy.on('finish', () => {

        log.debug('Done parsing form!');

        if (!sourceData) {

            let error = {
                error: "SourceDataNotProvided",
                errorMessage: "The Source data (as file, url/path, or directly as string), was not provided"
            };

            log.debug(error.error + " " + error.errorMessage);
            return res.status(400).send(error);
        }
    });

};