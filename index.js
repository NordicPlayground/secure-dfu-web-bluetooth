const fs = require('fs');

const AdmZip = require('adm-zip');


// https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk5.v12.0.0/lib_dfu_transport_ble.html?cp=4_0_0_3_4_3_2
const NORDIC_SEMI_BASE_UUID = '8EC90001-xxxx-4F60-9FB8-838830DAEA50';
const SECURE_DFU_SERVICE_UUID = NORDIC_SEMI_BASE_UUID.replace('xxxx', 'FE59');
const DFU_CONTROL_POINT_UUID = NORDIC_SEMI_BASE_UUID.replace('xxxx', '0001');
const DFU_PACKET_UUID = NORDIC_SEMI_BASE_UUID.replace('xxxx', '0002');


/**
 * Un-zips the compressed file and returns each entry contained in it.
 * @param {string} zipFilePath : The path to the compressed file to be un-zipped.
 * @return {array of strings} An array of strings corresponding to each entry in zipFilePath.
 */
function unZip(zipFilePath) {
  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();

  zip.extractAllTo(`${__dirname}/tmp`, true);

  const entryNames = [];
  zipEntries.forEach((zipEntry) => {
    entryNames.push(zipEntry.entryName);
  });

  return entryNames;
}


/**
 * See: https://github.com/NordicSemiconductor/pc-nrfutil/blob/master/nordicsemi/dfu/package.py#L79
        for a description of the manifest file.
 * @param {string} manifestFilePath : The path to the manifest file to be parsed.
 * @param {function} callback : Callback that will be fired with parsed data after asyn completion.
 * @return {int} Error code, 0 means SUCCESS.
 */
function parseManifest(manifestFilePath, callback) {
  fs.readFile(manifestFilePath, (err, data) => {
    if (err) {
      throw err;
    }
    callback(JSON.parse(data));
  });

  return 0;
}


exports.unZip = unZip;
exports.parseManifest = parseManifest;
