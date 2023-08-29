import koffi from 'koffi';

// Load the shared library
const oo2core = koffi.load('liboo2corelinux64_dbg.so.9');
//const oo2core = koffi.load('liboo2corelinux64.so.9');

const OodleLZ_Decompress = oo2core.func('long OodleLZ_Decompress(const void * compBuf, long compBufSize,\
  _Inout_ void * rawBuf,  long rawLen, \
  int fuzzSafe,\
  int checkCRC,\
  int verbose,\
  void * v_decBufBase,\
  long decBufSize,\
  void * fpCallback,\
  void * callbackUserData,\
  void * decoderMemory,\
  long decoderMemorySize,\
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
export function OodleDecompress (compressed: Buffer, compressedSize: number, uncompressed: Buffer, uncompressedSize: number, outputMessage: string){   
    // create uncompressed buffer for result
    //let uncompressed = Buffer.alloc(uncompressedSize);
    
    let src = Uint8Array.from(compressed);
    let dest = new Uint8Array(uncompressedSize);
    // uncompressed ...
    let res = OodleLZ_Decompress(src, src.length, dest, dest.length, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0);
    
    uncompressed = Buffer.from(dest);

    // decompress error
    if (res <= 0){
        outputMessage="OodleLZ_Decompress failed with result "+res;
        return -1;
    } 

    // decompress return shorter size
    if (res < uncompressedSize){
        outputMessage="OodleLZ_Decompress return " + res + " bytes instead of " + uncompressedSize;
    } else {
        outputMessage="OK"
    }  
    
    return res;
} 
