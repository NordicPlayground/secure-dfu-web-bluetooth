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
