'use strict';

const express = require('express');
const multer  = require('multer');
//const Buffer  = require('node:buffer');

// Constants
const LOADING_COMPRESSION_CHUNK_SIZE = 131072;

// Parameters for web server
const PORT = 8080;
const HOST = '0.0.0.0';

// App
var app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.post('/getRawDatabaseImage', multer({storage: multer.memoryStorage()}).single("file"), (req, res) => {
  if (req.file) {
    // Check file is big enough.
    if (req.file.size <= 1024) {
      res.status(422).send('File too short.');
      return;
    }
    // Check that file is a save game file.
    var magic = req.file.buffer.toString(undefined, 0, 4);
    if (magic != 'GVAS'){
      res.status(422).send('Not a save file.');
      return;
    }

    // Check if file contains RawDatabaseImage
    var rdi = req.file.buffer.indexOf('RawDatabaseImage');
    if (rdi <= 0){
      res.status(422).send('No RawDatabaseImage in file.');
      return;
    }
    // Move to the beginning of the Image
    rdi += 17; // RawDatabaseImage
    rdi += 4;  // length of ArrayProperty
    rdi += 14; // Word ArrayProperty
    rdi += 8;  // int64 arraysize  790334=000C0F3E
    rdi += 4;  // length of ByteProperty
    rdi += 13  // Word ByteProperty
    rdi ++;    // padding
    // Get the length of the image 
    var rdi_length = req.file.buffer.readUInt32LE(rdi); // int32 element count 790330=000C0F3A
    rdi += 4;
    // Get the image
    var image = req.file.buffer.subarray(rdi, rdi + rdi_length);

    // Check that we read get the image correctly.
    if (image.length != rdi_length){
      res.status(422).send('Length should by '+rdi_length+' but get '+image.length);
      return;
    }   
    // rdi_length bytes later
    // int32 length of RawExclusiveImage ... (also a ArrayProperty of ByteProperty)
  
    // Check that image type
    var compress_tag = Buffer.from("c1832a9e", 'hex'); // compress file
    var sqlite_tag = Buffer.from("SQLi", 'ascii'); // SQLlite

    // if image is a sqlite file send it directly.
    if (image.subarray(0,4).equals(sqlite_tag)){
      res.send(image);
      return;
    } else if (! image.subarray(0,4).equals(compress_tag)) {
      // if image is not a compressed file => Error
      res.status(422).send('RawDatabaseImage is not a compressed file.');
      return;
    } 
    
    // we have a compressed file  in image
    // res.send(image);  // output compressed file for debug.

    
    var i = 0; // index on image
    i+= 16; // 16 bytes = header (compress tag ....)
    // 16 bytes = summary (int64 = compressedsize, int64 = uncompressedsize)
    var compressedSize = image.readBigInt64LE(i); i+=8;
    var uncompressedSize = image.readBigInt64LE(i); i+=8;

    // several 16 bytes for the chunks  => check if compressed side from summary could be enough.
    var totalChunkCount = (uncompressedSize + BigInt(LOADING_COMPRESSION_CHUNK_SIZE - 1)) / BigInt(LOADING_COMPRESSION_CHUNK_SIZE);
    var totalCompressedSize = BigInt(0);
    var totalUncompressedSize = BigInt(0);
    for (var chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++){
      totalCompressedSize += image.readBigInt64LE(i); i+=8;
      totalUncompressedSize += image.readBigInt64LE(i); i+=8;
    } 

    // uncompress buffer from i to totalCompressedSize 
    var uncompressed = Buffer.alloc(Number(totalUncompressedSize));
    var outputMessage = new String();
    var result = Decompress (image.subarray(i, Number(compressedSize)+i) , Number(totalCompressedSize), uncompressed, Number(totalUncompressedSize), outputMessage);

    if (result <= 0){
      res.status(422).send("Bad size, "+outputMessage);
      return;
    } 

    // get first 4 bytes as int32 = uncompressed size of image
    var uncompressedImageSize = uncompressed.readInt32LE(0);
    var compressedImageSize = uncompressed.readInt32LE(4);
    console.log(uncompressedImageSize +" "+compressedImageSize);
 

    // uncompress the image.
    var uncompressedImage = Buffer.alloc(uncompressedImageSize);
    outputMessage = "";
    result = Decompress (image, image.length, uncompressedImage, uncompressedImageSize, outputMessage);



    

    res.send('OK');
  } else{
    res.send('POST /getRawDatabaseImage: no file.');
  } 

  
})

app.listen(PORT, HOST, () => {
  console.log(`Running on http://${HOST}:${PORT}`);
});






// CommonJS syntax
const koffi = require('koffi');

// Load the shared library
const oo2core = koffi.load('liboo2corelinux64.so.9');

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
 * @param {int} compressedSize
 * @param {Buffer} uncompressed  
 * @param {int} uncompressedSize 
 * @param {string} outputMessage 
 * @returns -1 on error, size of decompress result otherwise
 */
function Decompress (compressed, compressedSize, uncompressed, uncompressedSize, outputMessage){   
    // create uncompressed buffer for result
    //let uncompressed = Buffer.alloc(uncompressedSize);

    // uncompressed ...
    let res = OodleLZ_Decompress(compressed, compressedSize, uncompressed, uncompressedSize, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3);

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

