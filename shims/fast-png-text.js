const { writeCrc } = require('../node_modules/fast-png/lib/helpers/crc.js');

// https://www.w3.org/TR/png/#11tEXt
const textChunkName = 'tEXt';
const NULL = 0;

// Expo's TextDecoder only accepts UTF-8 labels and throws on 'latin1',
// which crashes native startup when roslib loads fast-png.
// PNG tEXt chunks are ISO-8859-1: each byte maps 1:1 to a code unit.
function decodeLatin1(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

const latin1Decoder = { decode: decodeLatin1 };

function validateKeyword(keyword) {
  validateLatin1(keyword);
  if (keyword.length === 0 || keyword.length > 79) {
    throw new Error('keyword length must be between 1 and 79');
  }
}

const latin1Regex = new RegExp('^[\\u0000-\\u00FF]*$');
function validateLatin1(text) {
  if (!latin1Regex.test(text)) {
    throw new Error('invalid latin1 text');
  }
}

function decodetEXt(text, buffer, length) {
  const keyword = readKeyword(buffer);
  text[keyword] = readLatin1(buffer, length - keyword.length - 1);
}

function encodetEXt(buffer, keyword, text) {
  validateKeyword(keyword);
  validateLatin1(text);
  const length = keyword.length + 1 /* NULL */ + text.length;
  buffer.writeUint32(length);
  buffer.writeChars(textChunkName);
  buffer.writeChars(keyword);
  buffer.writeByte(NULL);
  buffer.writeChars(text);
  writeCrc(buffer, length + 4);
}

// https://www.w3.org/TR/png/#11keywords
function readKeyword(buffer) {
  buffer.mark();
  while (buffer.readByte() !== NULL) {
    /* advance */
  }
  const end = buffer.offset;
  buffer.reset();
  const keyword = latin1Decoder.decode(buffer.readBytes(end - buffer.offset - 1));
  // NULL
  buffer.skip(1);
  validateKeyword(keyword);
  return keyword;
}

function readLatin1(buffer, length) {
  return latin1Decoder.decode(buffer.readBytes(length));
}

module.exports = {
  textChunkName,
  decodetEXt,
  encodetEXt,
  readKeyword,
  readLatin1,
};
