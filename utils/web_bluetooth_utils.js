const bluetooth = require('bleat').webbluetooth;

const littleEndianUtils = require('./little_endian_utils');


// https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk5.v12.0.0/lib_dfu_transport_ble.html?cp=4_0_0_3_4_3_2
const BASE_SERVICE_UUID = '0000xxxx-0000-1000-8000-00805f9b34fb';
const SECURE_DFU_SERVICE_UUID = BASE_SERVICE_UUID.replace('xxxx', 'fe59');

const BASE_CHARACTERISTIC_UUID = '8ec9xxxx-f315-4f60-9fb8-838830daea50';
const DFU_CONTROL_POINT_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0001');
const DFU_PACKET_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0002');

const BLE_PACKET_SIZE = 20;


// TODO: This function should be made more generic without hard coded services/characteristics.
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
      resolve();
    })
    .catch((error) => {
      reject(error);
    });
  });
}


function sendData(characteristic, buffer) {
  return new Promise((resolve, reject) => {
    if (buffer.length <= 0) {
      resolve();
    } else {
      // HACK: Needed side effect here, littleEndian is converting buffer to UInt8 Array...
      characteristic.writeValue(littleEndianUtils.littleEndian(buffer.slice(0, BLE_PACKET_SIZE)))
      .then(() => sendData(characteristic, buffer.slice(BLE_PACKET_SIZE)))
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
    }
  });
}


exports.deviceDiscover = deviceDiscover;
exports.enableNotifications = enableNotifications;
exports.sendData = sendData;

exports.SECURE_DFU_SERVICE_UUID = SECURE_DFU_SERVICE_UUID;
exports.DFU_CONTROL_POINT_UUID = DFU_CONTROL_POINT_UUID;
exports.DFU_PACKET_UUID = DFU_PACKET_UUID;
