'use strict';

import express from 'express';
import multer  from 'multer';
import { Buffer } from 'node:buffer';
import { FArchiveLoadCompressedProxy } from './farchiveloadcompressedproxy';

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

    var proxy = new FArchiveLoadCompressedProxy(req.file.originalname, image);
    var uncompressed = proxy.ReadBuffer();

    console.log(uncompressed.subarray(0, 10));
        

    res.send('OK');
  } else{
    res.send('POST /getRawDatabaseImage: no file.');
  } 

  
})

app.listen(PORT, HOST, () => {
  console.log(`Running on http://${HOST}:${PORT}`);
});






