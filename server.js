'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const farchiveloadcompressedproxy_1 = require("./farchiveloadcompressedproxy");
const oodledecompress_1 = require("./oodledecompress");
const constants_1 = require("./constants");
// Parameters for web server
const PORT = 8080;
const HOST = '0.0.0.0';
// App
var app = (0, express_1.default)();
app.get('/', (req, res) => {
    res.send('Hello World');
});
app.post('/getRawDatabaseImage', (0, multer_1.default)({ storage: multer_1.default.memoryStorage() }).single("file"), (req, res) => {
    if (req.file) {
        // Check file is big enough.
        if (req.file.size <= 1024) {
            res.status(422).send('File too short.');
            return;
        }
        // Check that file is a save game file.
        var magic = req.file.buffer.toString(undefined, 0, 4);
        if (magic != 'GVAS') {
            res.status(422).send('Not a save file.');
            return;
        }
        // Check if file contains RawDatabaseImage
        var rdi = req.file.buffer.indexOf('RawDatabaseImage');
        if (rdi <= 0) {
            res.status(422).send('No RawDatabaseImage in file.');
            return;
        }
        // Move to the beginning of the Image
        rdi += 17; // RawDatabaseImage
        rdi += 4; // length of ArrayProperty
        rdi += 14; // Word ArrayProperty
        rdi += 8; // int64 arraysize  790334=000C0F3E
        rdi += 4; // length of ByteProperty
        rdi += 13; // Word ByteProperty
        rdi++; // padding
        // Get the length of the image 
        var rdi_length = req.file.buffer.readUInt32LE(rdi); // int32 element count 790330=000C0F3A
        rdi += 4;
        // Get the image
        var image = req.file.buffer.subarray(rdi, rdi + rdi_length);
        // Check that we read get the image correctly.
        if (image.length != rdi_length) {
            res.status(422).send('Length should by ' + rdi_length + ' but get ' + image.length);
            return;
        }
        // rdi_length bytes later
        // int32 length of RawExclusiveImage ... (also a ArrayProperty of ByteProperty)
        // Check that image type
        var compress_tag = Buffer.from("c1832a9e", 'hex'); // compress file
        var sqlite_tag = Buffer.from("SQLi", 'ascii'); // SQLlite
        // if image is a sqlite file send it directly.
        if (image.subarray(0, 4).equals(sqlite_tag)) {
            res.send(image);
            return;
        }
        else if (!image.subarray(0, 4).equals(compress_tag)) {
            // if image is not a compressed file => Error
            res.status(422).send('RawDatabaseImage is not a compressed file.');
            return;
        }
        // we have a compressed file  in image
        // res.send(image);  // output compressed file for debug.
        var proxy = new farchiveloadcompressedproxy_1.FArchiveLoadCompressedProxy(image);
        var i = 0; // index on image
        i += 16; // 16 bytes = header (compress tag ....)
        // 16 bytes = summary (int64 = compressedsize, int64 = uncompressedsize)
        var compressedSize = image.readBigInt64LE(i);
        i += 8;
        var uncompressedSize = image.readBigInt64LE(i);
        i += 8;
        // several 16 bytes for the chunks  => check if compressed side from summary could be enough.
        var totalChunkCount = (uncompressedSize + BigInt(constants_1.LOADING_COMPRESSION_CHUNK_SIZE - 1)) / BigInt(constants_1.LOADING_COMPRESSION_CHUNK_SIZE);
        var totalCompressedSize = BigInt(0);
        var totalUncompressedSize = BigInt(0);
        for (var chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
            totalCompressedSize += image.readBigInt64LE(i);
            i += 8;
            totalUncompressedSize += image.readBigInt64LE(i);
            i += 8;
        }
        // uncompress buffer from i to totalCompressedSize 
        var uncompressed = Buffer.alloc(Number(totalUncompressedSize));
        var outputMessage = "";
        var result = (0, oodledecompress_1.Decompress)(image.subarray(i, Number(compressedSize) + i), Number(totalCompressedSize), uncompressed, Number(totalUncompressedSize), outputMessage);
        if (result <= 0) {
            res.status(422).send("Bad size, " + outputMessage);
            return;
        }
        // get first 4 bytes as int32 = uncompressed size of image
        var uncompressedImageSize = uncompressed.readInt32LE(0);
        var compressedImageSize = uncompressed.readInt32LE(4);
        console.log(uncompressedImageSize + " " + compressedImageSize);
        // uncompress the image.
        var uncompressedImage = Buffer.alloc(uncompressedImageSize);
        outputMessage = "";
        result = (0, oodledecompress_1.Decompress)(image, image.length, uncompressedImage, uncompressedImageSize, outputMessage);
        res.send('OK');
    }
    else {
        res.send('POST /getRawDatabaseImage: no file.');
    }
});
app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
});
