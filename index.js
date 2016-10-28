const crc = require('crc');

const dfuBLEUtils = require('./utils/web_bluetooth_utils');
const fileUtils = require('./utils/file_utils');
const littleEndianUtils = require('./utils/little_endian_utils');


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
        offset: littleEndianUtils.littleEndianUInt32(response.getUint32(CALCULATE_CHECKSUM_RESPONSE_FIELD.OFFSET)),
        crc32: littleEndianUtils.littleEndianUInt32(response.getUint32(CALCULATE_CHECKSUM_RESPONSE_FIELD.CRC32)),
      };
      break;
    case CONTROL_OPCODES.EXECUTE:
      break;
    case CONTROL_OPCODES.SELECT:
      responseSpecificData = {
        maximumSize: littleEndianUtils.littleEndianUInt32(response.getUint32(SELECT_RESPONSE_FIELD.MAXIMUM_SIZE)),
        offset: littleEndianUtils.littleEndianUInt32(response.getUint32(SELECT_RESPONSE_FIELD.OFFSET)),
        crc32: littleEndianUtils.littleEndianUInt32(response.getUint32(SELECT_RESPONSE_FIELD.CRC32)),
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


let gatt;
let expectedCRC;


function controlPointNotificationHandler(event) {
  const response = event.target.value;
  const parsedResponse = parseResponse(response);
  const responseOpCode = parsedResponse.responseOpCode;

  console.log(parsedResponse);

  switch (responseOpCode) {
    case CONTROL_OPCODES.CREATE:
      console.log('CREATE');
      gatt.controlPointCharacteristic.writeValue(
        new Uint8Array([CONTROL_OPCODES.SET_PRN, 0x00, 0x00])) // TODO:
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.SET_PRN:
      console.log('SET_PRN');
      fileUtils.parseBinaryFile(`${__dirname}/tmp/nrf52832_xxaa.dat`)
      .then((result) => {
        expectedCRC = crc.crc32(result);
        console.log(expectedCRC);
        return dfuBLEUtils.sendData(gatt.packetCharacteristic, result);
      })
      .then(() => gatt.controlPointCharacteristic.writeValue(
          new Uint8Array([CONTROL_OPCODES.CALCULATE_CHECKSUM])))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.CALCULATE_CHECKSUM:
      console.log('CALCULATE_CHECKSUM');
      // TODO: Check if offset and crc is correct before executing.
      gatt.controlPointCharacteristic.writeValue(new Uint8Array([CONTROL_OPCODES.EXECUTE]))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.EXECUTE:
      console.log('EXECUTE');
      gatt.controlPointCharacteristic.removeEventListener('characteristicvaluechanged',
        controlPointNotificationHandler);
      gatt.controlPointCharacteristic.addEventListener('characteristicvaluechanged',
        dataEventListener);
      gatt.controlPointCharacteristic.writeValue(
        new Uint8Array([CONTROL_OPCODES.SELECT, CONTROL_PARAMETERS.DATA_OBJECT]))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.SELECT:
      console.log('SELECT');
      // TODO: Some logic to determine if a new object should be created or not.
      gatt.controlPointCharacteristic.writeValue(
        new Uint8Array([CONTROL_OPCODES.CREATE,
                        CONTROL_PARAMETERS.COMMAND_OBJECT,
                        0x8a, 0x0, 0x0, 0x0])) // TODO: Size should not be hard-coded.
      .catch((error) => {
        throw error;
      });
      break;
    default:
      throw new Error(`Unknwon response op-code received: ${controlOpCodeToString(responseOpCode)}.`);
  }
}


let imageBuf;

function dataEventListener(event) {
  const response = event.target.value;
  const parsedResponse = parseResponse(response);
  const responseOpCode = parsedResponse.responseOpCode;

  console.log(parsedResponse);

  switch (responseOpCode) {
    case CONTROL_OPCODES.CREATE:
      console.log('CREATE');
      dfuBLEUtils.sendData(gatt.packetCharacteristic, imageBuf.slice(0, 0x1000))
      .then(() => gatt.controlPointCharacteristic.writeValue(
          new Uint8Array([CONTROL_OPCODES.CALCULATE_CHECKSUM])))
      .catch((error) => {
        throw error;
      });
      break;
    case CONTROL_OPCODES.SET_PRN:
      console.log('SET_PRN');
      break;
    case CONTROL_OPCODES.CALCULATE_CHECKSUM:
      console.log('CALCULATE_CHECKSUM');
      expectedCRC = crc.crc32(imageBuf.slice(0, 0x1000));
      console.log(expectedCRC);
      imageBuf = imageBuf.slice(0x1000);
      if (imageBuf.length !== 0) {
        dfuBLEUtils.sendData(gatt.packetCharacteristic, imageBuf.slice(0, 0x1000))
        .then(() => gatt.controlPointCharacteristic.writeValue(
          new Uint8Array([CONTROL_OPCODES.CALCULATE_CHECKSUM])))
        .catch((error) => {
          throw error;
        });
      } else {
        gatt.controlPointCharacteristic.writeValue(new Uint8Array([CONTROL_OPCODES.EXECUTE]))
        .catch((error) => {
          throw error;
        });
      }
      break;
    case CONTROL_OPCODES.EXECUTE:
      console.log('EXECUTE');
      break;
    case CONTROL_OPCODES.SELECT:
      console.log('SELECT');
      fileUtils.parseBinaryFile(`${__dirname}/tmp/nrf52832_xxaa.bin`)
      .then((result) => {
        imageBuf = result;
        console.log(imageBuf.length);
        return gatt.controlPointCharacteristic.writeValue(
          new Uint8Array([CONTROL_OPCODES.CREATE,
            CONTROL_PARAMETERS.DATA_OBJECT,
            0x0, 0x10, 0x0, 0x0])); // TODO: Size should not be hard-coded.
      })

      .catch((error) => {
        throw error;
      });
      break;
    default:
      throw new Error(`Unknwon response op-code received: ${controlOpCodeToString(responseOpCode)}.`);
  }
}


function doDFU() {
  dfuBLEUtils.deviceDiscover()
  .then((result) => {
    gatt = result;
    return dfuBLEUtils.enableNotifications(gatt.controlPointCharacteristic, controlPointNotificationHandler);
  })
  .then(() => gatt.controlPointCharacteristic.writeValue(
    new Uint8Array([CONTROL_OPCODES.SELECT, CONTROL_PARAMETERS.COMMAND_OBJECT])))
  .catch((error) => {
    throw error;
  });
}


doDFU();

// Export global variables for testing.
exports.CONTROL_OPCODES = CONTROL_OPCODES;

// Export functions for testing.
exports.parseResponse = parseResponse;
