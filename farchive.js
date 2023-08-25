class FArchive{
    constructor(){
        console.log('FArchive');
    }
} 

module.exports = FArchive;


/*
const fs = require('fs');

class FArchive {
  constructor(filePath) {
    this.filePath = filePath;
    this.file = fs.readFileSync(filePath); // Open and read the file
    this.offset = 0; // Maintain the current offset in the file
  }

  close() {
    // Close the file if needed
    // Depending on your use case, you might not need this method in Node.js
  }

  readInt32() {
    // Read a 32-bit integer from the file at the current offset
    const value = this.file.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readString() {
    // Read a string from the file at the current offset
    let length = this.readInt32();
    if (length <= 0) return "";

    const stringStartOffset = this.offset;
    this.offset += length;

    return this.file.slice(stringStartOffset, this.offset).toString();
  }

  // Add other methods as needed

  // Example usage
  exampleUsage() {
    const myInt = this.readInt32();
    const myString = this.readString();
    console.log(myInt, myString);
  }
}

// Example usage
const archive = new FArchive('/path/to/your/file');
archive.exampleUsage();





const fs = require('fs');
const zlib = require('zlib');

function SerializeCompressedNew(dest, length, compressionFormatToDecodeOldV1Files, flags, bTreatBufferAsFileReader, outPartialReadLength) {
    // CompressionFormatToEncode can be changed freely without breaking loading of old files
    // CompressionFormatToDecodeOldV1Files must match what was used to encode old files, cannot change

    // Serialize package file tag used to determine endianess.
    const packageFileTag = ReadFCompressedChunkInfo();

    // v1 header did not store CompressionFormatToDecode
    // assume it was CompressionFormatToDecodeOldV1Files (usually Zlib)
    const compressionFormatToDecode = compressionFormatToDecodeOldV1Files;

    let bHeaderWasValid = false;
    let bWasByteSwapped = false;
    let bReadCompressionFormat = false;

    // FPackageFileSummary has int32 Tag == PACKAGE_FILE_TAG
    // this header does not otherwise match FPackageFileSummary in any way

    // low 32 bits of ARCHIVE_V2_HEADER_TAG are == PACKAGE_FILE_TAG
    const ARCHIVE_V2_HEADER_TAG = PACKAGE_FILE_TAG | (0x22222222 << 32);

    if (packageFileTag.CompressedSize === PACKAGE_FILE_TAG) {
        // v1 header, not swapped
        bHeaderWasValid = true;
    } else if (packageFileTag.CompressedSize === PACKAGE_FILE_TAG_SWAPPED ||
        packageFileTag.CompressedSize === BYTESWAP_ORDER64(PACKAGE_FILE_TAG)) {
        // v1 header, swapped
        bHeaderWasValid = true;
        bWasByteSwapped = true;
    } else if (packageFileTag.CompressedSize === ARCHIVE_V2_HEADER_TAG ||
        packageFileTag.CompressedSize === BYTESWAP_ORDER64(ARCHIVE_V2_HEADER_TAG)) {
        // v2 header
        bHeaderWasValid = true;
        bWasByteSwapped = (packageFileTag.CompressedSize !== ARCHIVE_V2_HEADER_TAG);
        bReadCompressionFormat = true;

        // read CompressionFormatToDecode
        // FCompressionUtil.SerializeCompressorName(this, ref compressionFormatToDecode);
        throw new Error('Not implemented');
    } else {
        throw new Error('BulkData compressed header read error. This package may be corrupt!');
    }

    if (!bReadCompressionFormat) {
        // upgrade old flag method
        if (flags & COMPRESS_DeprecatedFormatFlagsMask) {
            console.warn('Old style compression flags are being used with FAsyncCompressionChunk, please update any code using this!');
            // compressionFormatToDecode = FCompression.GetCompressionFormatFromDeprecatedFlags(flags);
            throw new Error('Not implemented');
        }
    }

    // CompressionFormatToDecode came from disk, need to validate it :
    const compressionFormat = compressionFormatToDecode;
    if (!isValidCompressionFormat(compressionFormat)) {
        throw new Error(`BulkData compressed header read error. This package may be corrupt!\nCompressionFormatToDecode not found : ${compressionFormatToDecode}`);
    }

    // Read in base summary, contains total sizes :
    const summary = ReadFCompressedChunkInfo();

    if (bWasByteSwapped) {
        summary.CompressedSize = BYTESWAP_ORDER64(summary.CompressedSize);
        summary.UncompressedSize = BYTESWAP_ORDER64(summary.UncompressedSize);
        packageFileTag.UncompressedSize = BYTESWAP_ORDER64(packageFileTag.UncompressedSize);
    }

    // Handle change in compression chunk size in backward compatible way.
    let loadingCompressionChunkSize = packageFileTag.UncompressedSize;
    if (loadingCompressionChunkSize === PACKAGE_FILE_TAG) {
        loadingCompressionChunkSize = LOADING_COMPRESSION_CHUNK_SIZE;
    }

    if (!(loadingCompressionChunkSize > 0)) {
        throw new Error('Invalid loadingCompressionChunkSize');
    }

    // check Summary.UncompressedSize vs [V,Length] passed in
    // UncompressedSize smaller than length is okay
    if (summary.UncompressedSize > length) {
        throw new Error(`Archive SerializedCompressed UncompressedSize (${summary.UncompressedSize}) > Length (${length})`);
    }
    outPartialReadLength = summary.UncompressedSize;

    // Figure out how many chunks there are going to be based on uncompressed size and compression chunk size.
    const totalChunkCount = Math.ceil(summary.UncompressedSize / loadingCompressionChunkSize);

    // Allocate compression chunk infos and serialize them, keeping track of max size of compression chunks used.
    const compressionChunks = [];
    let maxCompressedSize = 0;
    let totalChunkCompressedSize = 0;
    let totalChunkUncompressedSize = 0;
    for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
        const chunk = ReadFCompressedChunkInfo();
        if (bWasByteSwapped) {
            chunk.CompressedSize = BYTESWAP_ORDER64(chunk.CompressedSize);
            chunk.UncompressedSize = BYTESWAP_ORDER64(chunk.UncompressedSize);
        }
        maxCompressedSize = Math.max(chunk.CompressedSize, maxCompressedSize);

        totalChunkCompressedSize += chunk.CompressedSize;
        totalChunkUncompressedSize += chunk.UncompressedSize;
        compressionChunks.push(chunk);
    }

    // verify the CompressionChunks[] sizes we read add up to the total we read
    if (totalChunkCompressedSize !== summary.CompressedSize) {
        throw new Error(`Archive SerializedCompressed TotalChunkCompressedSize (${totalChunkCompressedSize}) != Summary.CompressedSize (${summary.CompressedSize})`);
    }
    if (totalChunkUncompressedSize !== summary.UncompressedSize) {
        throw new Error(`Archive SerializedCompressed TotalChunkUncompressedSize (${totalChunkUncompressedSize}) != Summary.UnompressedSize (${summary.UncompressedSize})`);
    }

    // Set up destination pointer and allocate memory for compressed chunk[s] (one at a time).
    if (bTreatBufferAsFileReader) {
        throw new Error('bTreatBufferAsFileReader is not supported in Node.js');
    }
    let destPos = 0;
    const compressedBuffer = Buffer.allocUnsafe(maxCompressedSize);

    // Iterate over all chunks, serialize them into memory and decompress them directly into the destination pointer
    for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
        const chunk = compressionChunks[chunkIndex];
        // Read compressed data.
        fs.readSync(compressedBuffer, 0, chunk.CompressedSize);

        // Decompress into dest pointer directly.
        try {
            const uncompressedData = zlib.unzipSync(compressedBuffer.slice(0, chunk.CompressedSize));
            uncompressedData.copy(dest, destPos, 0, chunk.UncompressedSize);
            console.log(chunk.CompressedSize + ' ' + chunk.UncompressedSize);
        } catch (err) {
            throw new Error(`Failed to uncompress data in ${Name}, CompressionFormatToDecode=${compressionFormatToDecode}`);
        }

        // And advance it by read amount.
        destPos += chunk.CompressedSize;
    }
}
*/