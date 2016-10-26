const fs = require('fs');

const expect = require('chai').expect;

const fileUtils = require('../utils/file_utils');
const index = require('../index');


describe('#unZip', () => {
  it('should un-zip test_resources/dfu_test_app_hrm_s132.zip and print it\'s contents.', () => {
    const result = fileUtils.unZip(`${__dirname}/test_resources/dfu_test_app_hrm_s132.zip`);
    expect(result.toString()).to.equal(['manifest.json', 'nrf52832_xxaa.bin', 'nrf52832_xxaa.dat'].toString());

    expect(fs.lstatSync(`${__dirname}/../tmp`).isDirectory()).to.equal(true);
  });

  it('should parse the manifest.json file passed to it and return a json object.', (done) => {
    const errCode = fileUtils.parseManifest(`${__dirname}/../tmp/manifest.json`, (result) => {
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

  // TODO: HACK.
  let globalDone;

  function notificationHandler(event) {
    const response = event.target.value;
    const parsedResponse = index.parseResponse(response);

    if (parsedResponse.responseOpCode === 6) {
      expect(parsedResponse.data.maximumSize).to.equal(65536);
      expect(parsedResponse.data.offset).to.equal(0);
      expect(parsedResponse.data.crc32).to.equal(0);
    } else if (parsedResponse.responseOpCode === 1) {
      expect(parsedResponse.data).to.equal(undefined);
    }

    globalDone();
  }

  it('should succesfully enable notifications on the control point characteristic.', (done) => {
    globalDone = done;
    index.enableNotifications(gatt.controlPointCharacteristic, notificationHandler)
    .then((result) => {
      expect(result).to.equal(true);
      const writeVal = new Uint8Array([0x06, 0x01]);
      return gatt.controlPointCharacteristic.writeValue(writeVal);
    })
    .catch((error) => {
      throw error;
    });
  });

  it('should send create command.', (done) => {
    globalDone = done;
    const writeVal = new Uint8Array([0x01, 0x01, 0x64, 0x0, 0x0, 0x0]);
    gatt.controlPointCharacteristic.writeValue(writeVal)
    .catch((error) => {
      throw error;
    });
  });
});
