const bluetooth = require('bleat').webbluetooth;

const fileUtils = require('./utils/file_utils');

// https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk5.v12.0.0/lib_dfu_transport_ble.html?cp=4_0_0_3_4_3_2
const BASE_SERVICE_UUID = '0000xxxx-0000-1000-8000-00805f9b34fb';
const SECURE_DFU_SERVICE_UUID = BASE_SERVICE_UUID.replace('xxxx', 'fe59');

const BASE_CHARACTERISTIC_UUID = '8ec9xxxx-f315-4f60-9fb8-838830daea50';
const DFU_CONTROL_POINT_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0001');
const DFU_PACKET_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0002');

const BLE_PACKET_SIZE = 20;

// Control point procedure opcodes.
const CONTROL_OPCODES = {
  CREATE: 0x01,
  SET_PRN: 0x02,
  CALCULATE_CHECKSUM: 0x03,
  EXECUTE: 0x04,
  SELECT: 0x06,
  RESPONSE_CODE: 0x60,
};

const CONTROL_PARAMETERS = {
  COMMAND_OBJECT: 0x01,
  DATA_OBJECT: 0x02,
  // size: Object size in little endian, set by caller.
  // vale: Number of packets to be sent before receiving a PRN, set by caller. Default == 0.
};

// Index of response value fields in response packet.
const BASE_POS = 3;

const CALCULATE_CHECKSUM_RESPONSE_FIELD = {
  OFFSET: BASE_POS + 0,
  CRC32: BASE_POS + 4,
};

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
      resolve();
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

  console.log(response);

  if (responseCode !== CONTROL_OPCODES.RESPONSE_CODE) {
    throw new Error(`Unexpected response code received: ${controlOpCodeToString(responseCode)}.`);
  }
  if (resultCode !== RESULT_CODES.SUCCESS) {
    throw new Error(`Error in result code: ${resultCodeToString(resultCode)}.`);
  }

  switch (responseOpCode) {
    case CONTROL_OPCODES.CREATE:
      break;
    case CONTROL_OPCODES.SET_PRN:
      break;
    case CONTROL_OPCODES.CALCULATE_CHECKSUM:
      responseSpecificData = {
        offset: response.getUint32(CALCULATE_CHECKSUM_RESPONSE_FIELD.OFFSET),
        crc32: response.getUint32(CALCULATE_CHECKSUM_RESPONSE_FIELD.CRC32),
      };
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


function littleEndian(src) {
  const buffer = new Buffer(src.length);

  for (let i = 0, j = src.length - 1; i <= j; ++i, --j) {
    buffer[i] = src[j];
    buffer[j] = src[i];
  }

  return buffer;
}


function sendData(characteristic, buffer) {
  if (characteristic.uuid !== DFU_PACKET_UUID) {
    throw new Error('Data must be written to the data point characteristic.');
  }

  return new Promise((resolve, reject) => {
    if (buffer.length <= 0) {
      resolve();
    } else {
      characteristic.writeValue(littleEndian(buffer.slice(0, BLE_PACKET_SIZE)))
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


/* Use the functions above to do the DFU. */

let gatt;


function controlPointNotificationHandler(event) {
  const response = event.target.value;
  const parsedResponse = parseResponse(response);
  const responseOpCode = parsedResponse.responseOpCode;

  console.log(parsedResponse);

  switch (responseOpCode) {
    case CONTROL_OPCODES.CREATE:
      console.log('CREATE');
      gatt.controlPointCharacteristic.writeValue(
        new Uint8Array([CONTROL_OPCODES.SET_PRN, 0x00, 0x00]))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.SET_PRN:
      console.log('SET_PRN');
      fileUtils.parseBinaryFile(`${__dirname}/tmp/nrf52832_xxaa.dat`)
      .then(result => sendData(gatt.packetCharacteristic, result))
      .then(() => gatt.controlPointCharacteristic.writeValue(
          new Uint8Array([CONTROL_OPCODES.CALCULATE_CHECKSUM])))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.CALCULATE_CHECKSUM:
      console.log('CALCULATE_CHECKSUM');
      gatt.controlPointCharacteristic.writeValue(new Uint8Array([CONTROL_OPCODES.EXECUTE]))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.EXECUTE:
      console.log('EXECUTE');
      break;
    case CONTROL_OPCODES.SELECT:
      console.log('SELECT');
      // TODO: Some logic to determine if a new object should be created or not.
      gatt.controlPointCharacteristic.writeValue(
        new Uint8Array([CONTROL_OPCODES.CREATE,
                        CONTROL_PARAMETERS.COMMAND_OBJECT,
                        0x8a, 0x0, 0x0, 0x0]))
      .catch((error) => {
        throw error;
      });
      break;
    default:
      throw new Error(`Unknwon response op-code received: ${controlOpCodeToString(responseOpCode)}.`);
  }
}


function doDFU() {
  deviceDiscover()
  .then((result) => {
    gatt = result;
    return enableNotifications(gatt.controlPointCharacteristic, controlPointNotificationHandler);
  })
  .then(() => gatt.controlPointCharacteristic.writeValue(
    new Uint8Array([CONTROL_OPCODES.SELECT, CONTROL_PARAMETERS.COMMAND_OBJECT])))
  .catch((error) => {
    throw error;
  });
}


doDFU();

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
exports.littleEndian = littleEndian;
