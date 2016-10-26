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


describe('#BLE -- NOTE: requires nRF52 device running secure_dfu_secure_dfu_ble_s132_pca10040_debug.hex in range of computer.', () => {
  let gatt;

  it('should succesfully scan for, connect to, and discover the services/characteristics of the DFU target device.', (done) => {
    index.deviceDiscover()
    .then((result) => {
      expect(result.device.name).to.equal('DfuTarg');
      expect(result.server.connected).to.equal(true);
      expect(result.service.uuid).to.equal(index.SECURE_DFU_SERVICE_UUID);
      expect(result.controlPointCharacteristic.uuid).to.equal(index.DFU_CONTROL_POINT_UUID);
      expect(result.packetCharacteristic.uuid).to.equal(index.DFU_PACKET_UUID);
      gatt = result;
      done();
    })
    .catch((error) => {
      throw error;
    });
  });

  it('should succesfully enable notifications on the control point characteristic.', (done) => {
    index.enableNotifications(gatt.controlPointCharacteristic, (event) => {
      console.log(event.target.value);
    })
    .then((result) => {
      expect(result).to.equal(true);
      done();
    })
    .catch((error) => {
      throw error;
    });
  });
});
