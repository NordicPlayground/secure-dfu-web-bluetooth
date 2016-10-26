const fs = require('fs');

const expect = require('chai').expect;

const index = require('../index');


describe('#unZip', () => {
  it('should un-zip test_resources/dfu_test_app_hrm_s132.zip and print it\'s contents.', () => {
    const result = index.unZip(`${__dirname}/test_resources/dfu_test_app_hrm_s132.zip`);
    expect(result.toString()).to.equal(['manifest.json', 'nrf52832_xxaa.bin', 'nrf52832_xxaa.dat'].toString());

    expect(fs.lstatSync(`${__dirname}/../tmp`).isDirectory()).to.equal(true);
  });

  it('should parse the manifest.json file passed to it and return a json object.', (done) => {
    const errCode = index.parseManifest(`${__dirname}/../tmp/manifest.json`, (result) => {
      expect(result.toString()).to.equal({ manifest: { application: { bin_file: 'nrf52832_xxaa.bin', dat_file: 'nrf52832_xxaa.dat' } } }.toString());
      done();
    });

    expect(errCode).to.equal(0);
  });
});


describe('#BLE -- NOTE: requires nRF52 device running secure_dfu_secure_dfu_ble_s132_pca10040_debug.hex in range.', () => {
  it('should succesfully scan for, connect to, and discover the services/characteristics of device.', (done) => {
    index.deviceDiscover()
    .then((result) => {
      expect(result).to.equal(true);
      done();
    })
    .catch((error) => {
      throw error;
    });
  });
});
