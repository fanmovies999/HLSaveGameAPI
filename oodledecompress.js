"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Decompress = void 0;
const koffi_1 = __importDefault(require("koffi"));
// Load the shared library
const oo2core = koffi_1.default.load('liboo2corelinux64.so.9');
const OodleLZ_Decompress = oo2core.func('long OodleLZ_Decompress(const void * compBuf, long compBufSize,\
  void * rawBuf,  long rawLen, \
  int a,\
  int b,\
  int c,\
  long d,\
  long e,\
  long f,\
  long g,\
  long h,\
  long i,\
  int threadPhase )');
/**
 *
 * @param {Buffer} compressed
 * @param {number} compressedSize
 * @param {Buffer} uncompressed
 * @param {number} uncompressedSize
 * @param {string} outputMessage
 * @returns -1 on error, size of decompress result otherwise
 */
function Decompress(compressed, compressedSize, uncompressed, uncompressedSize, outputMessage) {
    // create uncompressed buffer for result
    //let uncompressed = Buffer.alloc(uncompressedSize);
    // uncompressed ...
    let res = OodleLZ_Decompress(compressed, compressedSize, uncompressed, uncompressedSize, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3);
    // decompress error
    if (res <= 0) {
        outputMessage = "OodleLZ_Decompress failed with result " + res;
        return -1;
    }
    // decompress return shorter size
    if (res < uncompressedSize) {
        outputMessage = "OodleLZ_Decompress return " + res + " bytes instead of " + uncompressedSize;
    }
    else {
        outputMessage = "OK";
    }
    return res;
}
exports.Decompress = Decompress;
