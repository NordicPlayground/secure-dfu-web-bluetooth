'use strict';

const AdmZip = require('adm-zip');


/**
 * Un-zips the compressed file and returns each entry contained in it.
 * @param {string} zip_file_path : The path to the compressed file to be un-zipped.
 * @return {array of strings} An array of strings corresponding to each entry contained in the compressed file.
 */
function unZip(zip_file_path) {
    let zip = new AdmZip(zip_file_path);
    const zipEntries = zip.getEntries();

    zip.extractAllTo(`${__dirname}/tmp`, true);

    let entryNames = [];
    zipEntries.forEach(zipEntry => {
        entryNames.push(zipEntry.entryName);
    });

    return entryNames;
};


exports.unZip = unZip;