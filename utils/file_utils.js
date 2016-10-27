const fs = require('fs');

const AdmZip = require('adm-zip');


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
 */
function parseManifest(manifestFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(manifestFilePath, (error, data) => {
      if (error) {
        reject(error);
      }
      resolve(JSON.parse(data));
    });
  });
}


function parseBinaryFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (error, data) => {
      if (error) {
        reject(error);
      }
      resolve(data);
    });
  });
}


exports.unZip = unZip;
exports.parseManifest = parseManifest;
exports.parseBinaryFile = parseBinaryFile;
