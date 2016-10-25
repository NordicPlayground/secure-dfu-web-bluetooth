'use strict';

const fs = require('fs');

const expect = require('chai').expect;

const unZip = require('../index').unZip;
const parseManifest = require('../index').parseManifest;


describe('#unZip', () => {
    it('should un-zip test_resources/dfu_test_app_hrm_s132.zip and print it\'s contents.', function() {
        const result = unZip(`${__dirname}/test_resources/dfu_test_app_hrm_s132.zip`);
        expect(fs.lstatSync(`${__dirname}/../tmp`).isDirectory()).to.equal(true);
        expect(result.toString()).to.equal(['manifest.json', 'nrf52832_xxaa.bin', 'nrf52832_xxaa.dat'].toString())
    });

    it('should parse the manifest.json file passed to it and return a json object.', function() {
        const errCode = parseManifest(`${__dirname}/../tmp/manifest.json`, (result) => {
            expect(result).to.equal({ manifest: { application: { bin_file: 'nrf52832_xxaa.bin', dat_file: 'nrf52832_xxaa.dat' } } })
        });
        expect(errCode).to.equal(0)
    });
});
