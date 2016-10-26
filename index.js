const fs = require('fs');

const AdmZip = require('adm-zip');
const bluetooth = require('bleat').webbluetooth;

// https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk5.v12.0.0/lib_dfu_transport_ble.html?cp=4_0_0_3_4_3_2
const BASE_SERVICE_UUID = '0000xxxx-0000-1000-8000-00805f9b34fb';
const SECURE_DFU_SERVICE_UUID = BASE_SERVICE_UUID.replace('xxxx', 'fe59');

const BASE_CHARACTERISTIC_UUID = '8ec9xxxx-f315-4f60-9fb8-838830daea50';
const DFU_CONTROL_POINT_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0001');
const DFU_PACKET_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0002');

/* Control point procedure opcodes. */
const CONTROL_OPCODES = {
  CREATE: 0x01,
  SET_PRN: 0x02,
  CALCULATE_CHECKSUM: 0x03,
  EXECUTE: 0x04,
  SELECT: 0x06,
  RESPONSE_CODE: 0x60,
};


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
  fs.readFile(manifestFilePath, (error, data) => {
    if (error) {
      throw error;
    }
    callback(JSON.parse(data));
  });

  return 0;
}


function deviceDiscover() {
  let globalDevice;
  let globalServer;
  let dfuService;
  let controlPointChar;

  return new Promise((resolve, reject) => {
    bluetooth.requestDevice({ filters: [{ services: [SECURE_DFU_SERVICE_UUID] }] })
    .then((device) => {
      globalDevice = device;
      return device.gatt.connect();
    })
    .then((server) => {
      globalServer = server;
      return server.getPrimaryService(SECURE_DFU_SERVICE_UUID);
    })
    .then((service) => {
      dfuService = service;
      return service.getCharacteristic(DFU_CONTROL_POINT_UUID);
    })
    .then((characteristic) => {
      controlPointChar = characteristic;
      return dfuService.getCharacteristic(DFU_PACKET_UUID);
    })
    .then((characteristic) => {
      resolve({
        device: globalDevice,
        server: globalServer,
        service: dfuService,
        controlPointCharacteristic: controlPointChar,
        packetCharacteristic: characteristic,
      });
    })
    .catch((error) => {
      reject(error);
    });
  });
}


function enableNotifications(controlPointCharacteristic, eventListener) {
  return new Promise((resolve, reject) => {
    controlPointCharacteristic.startNotifications()
    .then(() => {
      controlPointCharacteristic.addEventListener('characteristicvaluechanged', eventListener);
      resolve(true);
    })
    .catch((error) => {
      reject(error);
    });
  });
}


function controlPointCharNotification(event) {
  console.log(event.target.value);
}


// Transfer of an init packet:

/* DFU controller -> Control Point: Select command. */

// Export global variables for testing.
exports.SECURE_DFU_SERVICE_UUID = SECURE_DFU_SERVICE_UUID;
exports.DFU_CONTROL_POINT_UUID = DFU_CONTROL_POINT_UUID;
exports.DFU_PACKET_UUID = DFU_PACKET_UUID;

// Export functions for testing.
exports.unZip = unZip;
exports.parseManifest = parseManifest;
exports.deviceDiscover = deviceDiscover;
exports.enableNotifications = enableNotifications;
