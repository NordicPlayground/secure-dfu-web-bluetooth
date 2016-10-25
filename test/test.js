'use strict';

const fs = require('fs');

const expect = require('chai').expect;
const unZip = require('../index').unZip;


describe('#unZip', () => {
    it('should un-zip test_resources/dfu_test_app_hrm_s132.zip and print it\'s contents.', function() {
        const result = unZip(`${__dirname}/test_resources/dfu_test_app_hrm_s132.zip`);
        expect(fs.lstatSync(`${__dirname}/../tmp`).isDirectory()).to.equal(true);
        expect(result.toString()).to.equal(['manifest.json', 'nrf52832_xxaa.bin', 'nrf52832_xxaa.dat'].toString())
    });
});
