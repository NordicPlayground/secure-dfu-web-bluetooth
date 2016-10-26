const bluetooth = require('bleat').webbluetooth;

// https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk5.v12.0.0/lib_dfu_transport_ble.html?cp=4_0_0_3_4_3_2
const BASE_SERVICE_UUID = '0000xxxx-0000-1000-8000-00805f9b34fb';
const SECURE_DFU_SERVICE_UUID = BASE_SERVICE_UUID.replace('xxxx', 'fe59');

const BASE_CHARACTERISTIC_UUID = '8ec9xxxx-f315-4f60-9fb8-838830daea50';
const DFU_CONTROL_POINT_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0001');
const DFU_PACKET_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0002');

// Control point procedure opcodes.
const CONTROL_OPCODES = {
  CREATE: 0x01,
  SET_PRN: 0x02,
  CALCULATE_CHECKSUM: 0x03,
  EXECUTE: 0x04,
  SELECT: 0x06,
  RESPONSE_CODE: 0x60,
};

// Index of response value fields in response packet.
const BASE_POS = 3;
const SELECT_RESPONSE_FIELD = {
  MAXIMUM_SIZE: BASE_POS + 0,
  OFFSET: BASE_POS + 4,
  CRC32: BASE_POS + 8,
};

// Possible result codes sent in the response packet.
const RESULT_CODES = {
  INVALID_CODE: 0x00,
  SUCCESS: 0x01,
  OPCODE_NOT_SUPPORTED: 0x02,
  INVALID_PARAMETER: 0x03,
  INSUFFICIENT_RESOURCES: 0x04,
  INVALID_OBJECT: 0x05,
  UNSUPPORTED_TYPE: 0x07,
  OPERATION_NOT_PERMITTED: 0x08,
  OPERATION_FAILED: 0x0A,
};

const reverseLookup = obj => val => {
  for (const k of Object.keys(obj)) {
    if (obj[k] === val) {
      return k;
    }
  }
  return 'UNKNOWN';
};

const controlOpCodeToString = reverseLookup(CONTROL_OPCODES);
// TODO: need for params?
const resultCodeToString = reverseLookup(RESULT_CODES);


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


function parseResponse(response) {
  const responseCode = response.getUint8(0);
  const responseOpCode = response.getUint8(1);
  const resultCode = response.getUint8(2);
  let responseSpecificData;

  if (responseCode !== CONTROL_OPCODES.RESPONSE_CODE) {
    throw new Error(`Unexpected response code received: ${controlOpCodeToString(responseCode)}.`);
  }
  if (resultCode !== RESULT_CODES.SUCCESS) {
    throw new Error(`Error in result code: ${resultCodeToString(resultCode)}.`);
  }

  switch (responseOpCode) {
    case CONTROL_OPCODES.CREATE:
      break;
    case CONTROL_OPCODES.SELECT:
      responseSpecificData = {
        maximumSize: response.getUint32(SELECT_RESPONSE_FIELD.MAXIMUM_SIZE),
        offset: response.getUint32(SELECT_RESPONSE_FIELD.OFFSET),
        crc32: response.getUint32(SELECT_RESPONSE_FIELD.CRC32),
      };
      break;
    default:
      throw new Error(`Unknwon response op-code received: ${controlOpCodeToString(responseOpCode)}.`);
  }

  return {
    responseCode: responseCode,
    responseOpCode: responseOpCode,
    resultCode: resultCode,
    data: responseSpecificData,
  };
}


// Scary stuff...
function sendData(characteristic, index, buffer) {
  return new Promise((resolve, reject) => {
    if (index < buffer.length) {
      if (index % 20 === 0) {
        characteristic.writeValue(buffer.slice(index - 20, index))
        .then(() => {
          index += 1;
          sendData(characteristic, index, buffer);
          resolve(); // TODO: Understand this unwrapping.
        })
        .catch((error) => {
          reject(error);
        });
      } else {
        index += 1;
        sendData(characteristic, index, buffer);
      }
    } else {
      const leftOver = index % 20;
      if (leftOver > 0) {
        characteristic.writeValue(buffer.slice(index - leftOver, index))
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
      }
    }
  });
}


// Export global variables for testing.
exports.SECURE_DFU_SERVICE_UUID = SECURE_DFU_SERVICE_UUID;
exports.DFU_CONTROL_POINT_UUID = DFU_CONTROL_POINT_UUID;
exports.DFU_PACKET_UUID = DFU_PACKET_UUID;

exports.CONTROL_OPCODES = CONTROL_OPCODES;

// Export functions for testing.
exports.deviceDiscover = deviceDiscover;
exports.enableNotifications = enableNotifications;
exports.parseResponse = parseResponse;
exports.sendData = sendData;
